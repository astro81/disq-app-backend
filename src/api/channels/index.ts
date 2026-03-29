import { Hono } from 'hono'

import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { channelTable, channelAccessTable } from '@/db/schema'

import { authMiddleware, type AuthVariables } from '@/middleware/auth'

import { getMembership, hasRole } from '@/utils/channel-permissions'

import create from '@/api/channels/create'
import edit from '@/api/channels/edit'
import remove from '@/api/channels/delete'

const app = new Hono<{ Variables: AuthVariables }>()

//! internally protected via authMiddleware
app.route('/', create)
app.route('/', edit)
app.route('/', remove)


// GET /api/channels?serverId=<id>
// - Admins and moderators see all channels (public + private)
// - Guests see public channels plus any private channels they have explicit access to
app.get('/', authMiddleware, async (c) => {
    const serverId = c.req.query('serverId')
    if (!serverId) return c.json({ error: 'serverId query param is required' }, 400)

    const membership = await getMembership(c, serverId)
    if (!membership) return c.json({ error: 'You are not a member of this server' }, 403)

    const channels = await db.query.channelTable.findMany({
        where: eq(channelTable.serverId, serverId),
        orderBy: asc(channelTable.position),
    })

    if (hasRole(membership.role, 'MODERATOR')) {
        return c.json(channels)
    }

    // For guests: find which private channels they have explicit access to
    const accessRows = await db
        .select({ channelId: channelAccessTable.channelId })
        .from(channelAccessTable)
        .where(eq(channelAccessTable.memberId, membership.memberId))

    const allowedPrivateIds = new Set(accessRows.map(r => r.channelId))

    const visible = channels.filter(ch =>
        !ch.isPrivateChannel || allowedPrivateIds.has(ch.channelId)
    )

    return c.json(visible)
})

// GET /api/channels/:channelId
app.get('/:channelId', authMiddleware, async (c) => {
    const { channelId } = c.req.param()

    const channel = await db.query.channelTable.findFirst({
        where: eq(channelTable.channelId, channelId),
    })

    if (!channel) return c.json({ error: 'Channel not found' }, 404)

    const membership = await getMembership(c, channel.serverId)
    if (!membership) return c.json({ error: 'You are not a member of this server' }, 403)

    if (channel.isPrivateChannel && !hasRole(membership.role, 'MODERATOR')) {
        const access = await db.query.channelAccessTable.findFirst({
            where: and(
                eq(channelAccessTable.channelId, channelId),
                eq(channelAccessTable.memberId, membership.memberId),
            ),
        })
        if (!access) return c.json({ error: 'You do not have access to this channel' }, 403)
    }

    return c.json(channel)
})

export default app