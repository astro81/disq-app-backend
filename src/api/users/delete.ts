import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable, refreshTokensTable } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'

const app = new Hono<{ Variables: AuthVariables }>()

// DELETE /api/users/me - delete own account
app.delete('/me', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub

    // Revoke all refresh tokens first
    await db
        .delete(refreshTokensTable)
        .where(eq(refreshTokensTable.userId, currentUserId))

    // Delete user
    await db
        .delete(usersTable)
        .where(eq(usersTable.id, currentUserId))

    return c.json({ message: 'Account deleted successfully' })
})

export default app