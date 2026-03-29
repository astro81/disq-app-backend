import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, type AuthVariables } from '@/middleware/auth';
import { db } from '@/db';
import { memberTable } from '@/db/server';
import { and, eq, sql } from 'drizzle-orm';

const app = new Hono<{ Variables: AuthVariables }>();

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json({ message: err.message }, err.status);
    }
    return c.json({ message: 'Internal server error' }, 500);
});

// PATCH /:serverId/members/:memberId/role
app.patch('/:serverId/members/:memberId/role', authMiddleware, async (c) => {
    const { serverId, memberId } = c.req.param();
    const userId = c.get('jwtPayload').sub;
    const { role } = await c.req.json();

    if (!role) throw new HTTPException(400, { message: 'Role is required' });

    if (!['ADMIN', 'MODERATOR', 'GUEST'].includes(role))
        throw new HTTPException(400, { message: 'Invalid role' });

    const currentMember = await db.query.memberTable.findFirst({
        where: (m, { and, eq }) =>
            and(eq(m.serverId, serverId), eq(m.userId, userId)),
    });

    if (!currentMember)
        throw new HTTPException(403, { message: 'You are not a member of this server' });

    if (currentMember.role !== 'ADMIN')
        throw new HTTPException(403, { message: 'Only admins can change member roles' });

    const targetMember = await db.query.memberTable.findFirst({
        where: (m, { and, eq }) =>
            and(eq(m.serverId, serverId), eq(m.memberId, memberId)),
    });

    if (!targetMember)
        throw new HTTPException(404, { message: 'Member not found' });

    if (targetMember.userId === userId)
        throw new HTTPException(400, { message: 'You cannot change your own role' });

    await db
        .update(memberTable)
        .set({ role })
        .where(eq(memberTable.memberId, memberId));

    return c.json({ message: 'Member role updated successfully' }, 200);
});

// DELETE /:serverId/members/:memberId/kick
app.delete('/:serverId/members/:memberId/kick', authMiddleware, async (c) => {
    const { serverId, memberId } = c.req.param();
    const userId = c.get('jwtPayload').sub;

    const currentMember = await db.query.memberTable.findFirst({
        where: (m, { and, eq }) =>
            and(eq(m.serverId, serverId), eq(m.userId, userId)),
    });

    if (!currentMember)
        throw new HTTPException(403, { message: 'You are not a member of this server' });

    if (!['ADMIN', 'MODERATOR'].includes(currentMember.role))
        throw new HTTPException(403, { message: 'You do not have permission to kick members' });

    const targetMember = await db.query.memberTable.findFirst({
        where: (m, { and, eq }) =>
            and(eq(m.serverId, serverId), eq(m.memberId, memberId)),
    });

    if (!targetMember)
        throw new HTTPException(404, { message: 'Member not found' });

    if (targetMember.userId === userId)
        throw new HTTPException(400, { message: 'You cannot kick yourself' });

    if (currentMember.role === 'MODERATOR' && targetMember.role === 'ADMIN')
        throw new HTTPException(403, { message: 'Moderators cannot kick admins' });

    if (targetMember.role === 'ADMIN') {
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(memberTable)
            .where(
                and(
                    eq(memberTable.serverId, serverId),
                    eq(memberTable.role, 'ADMIN')
                )
            );

        if (count <= 1)
            throw new HTTPException(400, { message: 'Server must have at least one admin' });
    }

    await db
        .delete(memberTable)
        .where(
            and(
                eq(memberTable.memberId, memberId),
                eq(memberTable.serverId, serverId)
            )
        );

    return c.json({ message: 'Member kicked successfully' }, 200);
});

export default app;