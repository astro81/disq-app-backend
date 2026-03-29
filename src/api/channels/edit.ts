import { Hono } from 'hono'
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { channelTable, channelTypeEnum, memberTable, channelAccessTable } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'
import { getMembership, hasRole, GENERAL_CHANNEL_NAME } from '@/utils/channel-permissions'


const app = new Hono<{ Variables: AuthVariables }>()


// PATCH /api/channels/:channelId - rename, change type, or toggle privacy
app.patch('/:channelId', authMiddleware, async (c) => {
    const { channelId } = c.req.param()

    const { channelName, channelType, isPrivateChannel } = await c.req.json<{
        channelName?: string
        channelType?: typeof channelTypeEnum.enumValues[number]
        isPrivateChannel?: boolean
    }>()

    const channel = await db.query.channelTable.findFirst({
        where: eq(channelTable.channelId, channelId),
    })

    if (!channel) return c.json({ error: 'Channel not found' }, 404)

    if (channel.channelName.toLowerCase() === GENERAL_CHANNEL_NAME)
        return c.json({ error: 'The general channel cannot be edited' }, 403)

    const membership = await getMembership(c, channel.serverId)

    if (!membership) return c.json({ error: 'You are not a member of this server' }, 403)
    
    if (!hasRole(membership.role, 'MODERATOR')) 
        return c.json({ error: 'Only admins and moderators can edit channels' }, 403)
    
    if (channelName?.trim().toLowerCase() === GENERAL_CHANNEL_NAME)
        return c.json({ error: 'Cannot rename a channel to "general"' }, 400)

    const [updated] = await db
        .update(channelTable)
        .set({
            ...(channelName?.trim() && { channelName: channelName.trim() }),
            ...(channelType !== undefined && { channelType }),
            ...(isPrivateChannel !== undefined && { isPrivateChannel }),
        })
        .where(eq(channelTable.channelId, channelId))
        .returning()

    return c.json({ message: 'Channel updated', channel: updated })
})


// PATCH /api/channels/:channelId/position - reorder a channel
// Body: { direction: 'up' | 'down' }  OR  { position: number }
app.patch('/:channelId/position', authMiddleware, async (c) => {
    const { channelId } = c.req.param()
    const body = await c.req.json<{ direction?: 'up' | 'down'; position?: number }>()

    const channel = await db.query.channelTable.findFirst({
        where: eq(channelTable.channelId, channelId),
    })

    if (!channel) return c.json({ error: 'Channel not found' }, 404)

    if (channel.channelName.toLowerCase() === GENERAL_CHANNEL_NAME)
        return c.json({ error: 'The general channel position cannot be changed' }, 403)

    const membership = await getMembership(c, channel.serverId)
    if (!membership) return c.json({ error: 'You are not a member of this server' }, 403)
    
        if (!hasRole(membership.role, 'MODERATOR')) 
        return c.json({ error: 'Only admins and moderators can reorder channels' }, 403)

    // All non-general channels sorted by position
    const channels = await db.query.channelTable.findMany({
        where: and(
            eq(channelTable.serverId, channel.serverId),
            ne(channelTable.channelName, GENERAL_CHANNEL_NAME),
        ),
        orderBy: asc(channelTable.position),
    })

    const currentIndex = channels.findIndex(ch => ch.channelId === channelId)
    if (currentIndex === -1) return c.json({ error: 'Channel not found in list' }, 404)

    let targetIndex: number

    if (body.direction === 'up') {
        targetIndex = Math.max(0, currentIndex - 1)
    } else if (body.direction === 'down') {
        targetIndex = Math.min(channels.length - 1, currentIndex + 1)
    } else if (body.position !== undefined) {
        // position is 1-based; general holds slot 1, non-general start at 2
        targetIndex = Math.max(0, Math.min(channels.length - 1, body.position - 2))
    } else {
        return c.json({ error: 'Provide direction ("up" | "down") or position' }, 400)
    }

    if (targetIndex === currentIndex) 
        return c.json({ message: 'No change needed' })
    
    const swapWith = channels[targetIndex]

    await db
        .update(channelTable)
        .set({ position: swapWith.position })
        .where(eq(channelTable.channelId, channel.channelId))

    await db
        .update(channelTable)
        .set({ position: channel.position })
        .where(eq(channelTable.channelId, swapWith.channelId))

    return c.json({ message: 'Channel reordered' })
})

// PATCH /api/channels/:channelId/access - grant or revoke a GUEST member's access to a private channel
// Body: { memberId: string, grant: boolean }
app.patch('/:channelId/access', authMiddleware, async (c) => {
    const { channelId } = c.req.param()
    const { memberId, grant } = await c.req.json<{ memberId: string; grant: boolean }>()

    if (!memberId) return c.json({ error: 'memberId is required' }, 400)

    const channel = await db.query.channelTable.findFirst({
        where: eq(channelTable.channelId, channelId),
    })

    if (!channel) return c.json({ error: 'Channel not found' }, 404)
    if (!channel.isPrivateChannel) return c.json({ error: 'Channel is not private' }, 400)

    const membership = await getMembership(c, channel.serverId)
    if (!membership) return c.json({ error: 'You are not a member of this server' }, 403)
    
    if (!hasRole(membership.role, 'MODERATOR')) 
        return c.json({ error: 'Only admins and moderators can manage channel access' }, 403)

    // Verify the target member belongs to the same server
    const targetMember = await db.query.memberTable.findFirst({
        where: and(
            eq(memberTable.memberId, memberId),
            eq(memberTable.serverId, channel.serverId),
        ),
    })

    if (!targetMember) return c.json({ error: 'Member not found in this server' }, 404)

    if (grant) {
        await db
            .insert(channelAccessTable)
            .values({ channelId, memberId })
            .onConflictDoNothing()

        return c.json({ message: `Access granted to member ${memberId}` })
    } else {
        await db
            .delete(channelAccessTable)
            .where(and(
                eq(channelAccessTable.channelId, channelId),
                eq(channelAccessTable.memberId, memberId),
            ))

        return c.json({ message: `Access revoked for member ${memberId}` })
    }
})

export default app