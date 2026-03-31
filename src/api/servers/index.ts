import { Hono } from 'hono'

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { memberTable, serverTable, usersTable } from '@/db/schema'

import { authMiddleware, type AuthVariables } from '@/middleware/auth'

import create from '@/api/servers/create'
import join from '@/api/servers/join'
import invite from '@/api/servers/invite'
import update from '@/api/servers/update'
import leave from '@/api/servers/leave'
import remove from '@/api/servers/remove'
import member from '@/api/servers/member'

import { getMembership } from '@/utils/channel-permissions'

const app = new Hono<{ Variables: AuthVariables }>()


//! internally protected via authMiddleware
app.route('/', create)
app.route('/', join)
app.route('/invite', invite)
app.route('/update', update)
app.route('/leave', leave)
app.route('/remove', remove)
app.route('/', member)

// GET /api/servers — all public servers with member counts
app.get('/', async (c) => {
    const servers = await db
        .select({
            serverId: serverTable.serverId,
            serverName: serverTable.serverName,
            serverDescription: serverTable.serverDescription,
            
            serverImageUrl: serverTable.serverImageUrl,
            serverBannerImageUrl: serverTable.serverBannerImageUrl,

            isPrivateServer: serverTable.isPrivateServer,
            createdAt: serverTable.createdAt,
            totalMembers: sql<number>`cast(count(${memberTable.memberId}) as int)`.as('total_members'),
        })
        .from(serverTable)
        .leftJoin(memberTable, eq(memberTable.serverId, serverTable.serverId))
        .where(eq(serverTable.isPrivateServer, false))
        .groupBy(serverTable.serverId)
        .orderBy(sql`count(${memberTable.memberId}) desc`)
 
    return c.json(servers)
})
 
// GET /api/servers/all - all servers (private + public)
app.get('/all', async (c) => {
    const servers = await db.query.serverTable.findMany()
    return c.json(servers)
})


// GET /api/servers/me - server IDs the current user has joined
// Must be before /:serverId to avoid route conflict
app.get('/me', authMiddleware, async (c) => {
    const userId = c.get('jwtPayload').sub
 
    const memberships = await db
        .select({ serverId: memberTable.serverId })
        .from(memberTable)
        .where(eq(memberTable.userId, userId))
 
    return c.json(memberships)
})
 
// GET /api/servers/:serverId - single server details
app.get('/:serverId', authMiddleware, async (c) => {
    try {
        const { serverId } = c.req.param()

        const server = await db.query.serverTable.findFirst({
            where: eq(serverTable.serverId, serverId),
        })
                
        if (!server) return c.json({ error: 'Server not found' }, 404)
        
        return c.json(server)
    } catch (error) {
        return c.json({ error: 'Internal server error', details: error.message }, 500);
    }
})


// GET /api/servers/:serverId/members - all members of a server
app.get('/:serverId/members', authMiddleware, async (c) => {
    const { serverId } = c.req.param()

    const server = await db.query.serverTable.findFirst({
        where: eq(serverTable.serverId, serverId),
    })
    if (!server) return c.json({ error: 'Server not found' }, 404)

    const membership = await getMembership(c, serverId)
    if (!membership) return c.json({ error: 'You are not a member of this server' }, 403)

    const members = await db
        .select({
            memberId: memberTable.memberId,
            role: memberTable.role,
            userId: memberTable.userId,
            serverId: memberTable.serverId,
            username: usersTable.username,
            displayName: usersTable.displayName,
            userProfileImage: usersTable.image,
            userBannerImage: usersTable.profileBannerImage,
            userEmail: usersTable.email,
            joinedAt: memberTable.createdAt,
            updatedAt: memberTable.updatedAt,
        })
        .from(memberTable)
        .innerJoin(usersTable, eq(memberTable.userId, usersTable.id))
        .where(eq(memberTable.serverId, serverId))

    return c.json(members)
})


// GET /api/servers/:serverId/currentMemver - the membership of the current user in the currnet server
app.get('/:serverId/currentMember', authMiddleware, async (c) => {
    const { serverId } = c.req.param()
    const userId = c.get('jwtPayload').sub

    const server = await db.query.serverTable.findFirst({
        where: eq(serverTable.serverId, serverId),
    })
    if (!server) return c.json({ error: 'Server not found' }, 404)

    const serverMember = await db.query.memberTable.findFirst({
        where: and(
            eq(memberTable.serverId, serverId),
            eq(memberTable.userId, userId)
        ),
    })
    if (!serverMember) return c.json({ error: 'Member not found' }, 404)

    const memberUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, serverMember.userId),
    })
    if (!memberUser) return c.json({ error: 'User not found' }, 404)

    return c.json({
        memberId: serverMember.memberId,
        role: serverMember.role,
        userId: serverMember.userId,
        serverId: serverMember.serverId,
        username: memberUser.username,
        displayName: memberUser.displayName,
        userProfileImage: memberUser.image,
        userBannerImage: memberUser.profileBannerImage,
        userEmail: memberUser.email,
        joinedAt: serverMember.createdAt,
        updatedAt: serverMember.updatedAt,
    })
})


export default app