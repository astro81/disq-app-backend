import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, type AuthVariables } from '@/middleware/auth';
import { db } from '@/db';
import { memberTable, serverTable } from '@/db/server';
import { eq } from 'drizzle-orm';

const app = new Hono<{ Variables: AuthVariables }>();

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json({ message: err.message }, err.status);
    }
    return c.json({ message: "Internal server error" }, 500);
});

app.delete('/:serverId', authMiddleware, async (c) => {
    const { serverId } = c.req.param();
    const userId = c.get('jwtPayload').sub;

    const existingMember = await db.query.memberTable.findFirst({
        where: (m, { eq, and }) =>
            and(eq(m.userId, userId), eq(m.serverId, serverId))
    });

    if (!existingMember) {
        throw new HTTPException(404, { message: "You are not a member of this server" });
    }

    if (existingMember.role !== "ADMIN") {
        throw new HTTPException(403, { message: "Only admins can delete the server" });
    }

    await db.delete(serverTable).where(eq(serverTable.serverId, serverId));

    return c.json({ message: "Successfully deleted the server" }, 200);
});

export default app;