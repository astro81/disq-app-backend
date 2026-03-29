import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { channelTable } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'
import { getMembership, hasRole, GENERAL_CHANNEL_NAME } from '@/utils/channel-permissions'

const app = new Hono<{ Variables: AuthVariables }>()

// DELETE /api/channels/:channelId
app.delete('/:channelId', authMiddleware, async (c) => {
    const { channelId } = c.req.param()

    const channel = await db.query.channelTable.findFirst({
        where: eq(channelTable.channelId, channelId),
    })

    if (!channel) return c.json({ error: 'Channel not found' }, 404)

    // The general channel is permanent
    if (channel.channelName.toLowerCase() === GENERAL_CHANNEL_NAME) 
        return c.json({ error: 'The general channel cannot be deleted' }, 403)

    const membership = await getMembership(c, channel.serverId)
    
    if (!membership) return c.json({ error: 'You are not a member of this server' }, 403)
    
    if (!hasRole(membership.role, 'MODERATOR')) 
        return c.json({ error: 'Only admins and moderators can delete channels' }, 403)

    await db.delete(channelTable).where(eq(channelTable.channelId, channelId))

    return c.json({ message: 'Channel deleted' })
})

export default app