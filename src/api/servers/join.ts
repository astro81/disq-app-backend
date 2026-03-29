import { db } from "@/db";
import { memberTable, serverTable } from "@/db/schema";
import { authMiddleware, type AuthVariables } from "@/middleware/auth";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

const app = new Hono<{ Variables: AuthVariables }>()

// POST /api/servers/:serverId/join - join a public server
app.post('/:serverId/join', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub
    const { serverId } = c.req.param()
 
    const server = await db.query.serverTable.findFirst({
        where: eq(serverTable.serverId, serverId),
    })
 
    if (!server) return c.json({ error: 'Server not found' }, 404)
    if (server.isPrivateServer) return c.json({ error: 'This server is private' }, 403)
 
    const existing = await db.query.memberTable.findFirst({
        where: and(
            eq(memberTable.serverId, serverId),
            eq(memberTable.userId, currentUserId),
        ),
    })
 
    if (existing) return c.json({ error: 'Already a member of this server' }, 409)
 
    await db.insert(memberTable).values({
        serverId,
        userId: currentUserId,
    })
 
    return c.json({ message: 'Joined server successfully', serverId }, 201)
})

export default app
