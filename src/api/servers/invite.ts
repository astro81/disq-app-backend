// /api/servers/invite/server.ts
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { serverTable, memberTable } from '@/db/schema';
import { authMiddleware, type AuthVariables } from '@/middleware/auth';

const app = new Hono<{ Variables: AuthVariables }>();


// POST /api/servers/invite/:inviteCode/join - Join a server using invite code
app.post('/:inviteCode/join', authMiddleware, async (c) => {
    try {
        const { inviteCode } = c.req.param();
        const userId = c.get('jwtPayload').sub;

        // First, find the server by invite code
        const server = await db.query.serverTable.findFirst({
            where: eq(serverTable.serverInviteCode, inviteCode),
            columns: {
                serverId: true,
                serverName: true,
                isPrivateServer: true,
            }
        });

        if (!server) {
            return c.json({ error: 'Invalid or expired invite link' }, 404);
        }

        // Check if user is already a member
        const existingMember = await db.query.memberTable.findFirst({
            where: and(
                eq(memberTable.serverId, server.serverId),
                eq(memberTable.userId, userId)
            ),
            columns: {
                memberId: true,
                serverId: true,
            }
        });

        // If already a member, return the server info
        if (existingMember) {
            return c.json({
                success: true,
                alreadyMember: true,
                serverId: server.serverId,
                serverName: server.serverName,
            });
        }

        // Add the user as a member
        try {
            await db.insert(memberTable).values({
                userId: userId,
                serverId: server.serverId,
                role: 'GUEST', // Default role
            });

            return c.json({
                success: true,
                alreadyMember: false,
                serverId: server.serverId,
                serverName: server.serverName,
            });

        } catch (error: any) {
            // Check for unique constraint violation (race condition)
            if (error.message?.includes('members_unique_user_server')) {
                return c.json({
                    success: true,
                    alreadyMember: true,
                    serverId: server.serverId,
                    serverName: server.serverName,
                });
            }
            throw error;
        }

    } catch (error) {
        console.error('Error joining server:', error);
        return c.json({ error: 'Failed to join server' }, 500);
    }
});

// PATCH /api/servers/invite/:serverId - Regenerate invite code for a server
app.patch('/:serverId', authMiddleware, async (c) => {
    try {
        const { serverId } = c.req.param();
        const userId = c.get('jwtPayload').sub;

        // Generate a new invite code
        const newInviteCode = crypto.randomUUID();

        // Update the server's invite code, ensuring the user is the server creator
        const result = await db.update(serverTable)
            .set({ 
                serverInviteCode: newInviteCode,
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(serverTable.serverId, serverId),
                    eq(serverTable.createdBy, userId)
                )
            )
            .returning({ 
                serverId: serverTable.serverId,
                serverInviteCode: serverTable.serverInviteCode 
            });

        if (!result || result.length === 0) {
            return c.json({ 
                error: 'Server not found or you do not have permission to modify this server' 
            }, 403);
        }

        return c.json({ 
            success: true, 
            serverInviteCode: result[0].serverInviteCode 
        });

    } catch (error) {
        console.error('Error regenerating invite code:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

export default app;