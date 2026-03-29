import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { channelTable, channelTypeEnum } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'
import { getMembership, hasRole, GENERAL_CHANNEL_NAME } from '@/utils/channel-permissions'

const app = new Hono<{ Variables: AuthVariables }>()

// POST /api/channels - create a channel in a server
// Body: { serverId, channelName, channelType?, isPrivateChannel? }
app.post('/', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub
    const { serverId, channelName, channelType, isPrivateChannel } = await c.req.json<{
        serverId: string
        channelName: string
        channelType?: typeof channelTypeEnum.enumValues[number]
        isPrivateChannel?: boolean
    }>()

    if (!serverId) return c.json({ error: 'serverId is required' }, 400)
    if (!channelName?.trim()) return c.json({ error: 'channelName is required' }, 400)

    // Prevent creating a channel named "general"
    // The "general" channel is added during server creation
    if (channelName.trim().toLowerCase() === GENERAL_CHANNEL_NAME) 
        return c.json({ error: 'A channel named "general" already exists and cannot be duplicated' }, 400)

    const membership = await getMembership(c, serverId)
    if (!membership) 
        return c.json({ error: 'You are not a member of this server' }, 403)
    
    if (!hasRole(membership.role, 'MODERATOR')) 
        return c.json({ error: 'Only admins and moderators can create channels' }, 403)
    

    // Position: append after the last channel (general is always position 1)
    const result = await db
        .select({ maxPosition: sql<number>`coalesce(max(${channelTable.position}), 1)` })
        .from(channelTable)
        .where(eq(channelTable.serverId, serverId))

    const nextPosition = (result[0]?.maxPosition ?? 1) + 1

    const [newChannel] = await db
        .insert(channelTable)
        .values({
            channelName: channelName.trim(),
            channelType: channelType ?? channelTypeEnum.enumValues[0], // TEXT
            position: nextPosition,
            isPrivateChannel: isPrivateChannel ?? false,
            createdBy: currentUserId,
            serverId,
        })
        .returning()

    return c.json({ message: 'Channel created', channel: newChannel }, 201)
})

export default app