import { Hono } from 'hono'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { refreshTokensTable } from '@/db/schema'

import { authMiddleware, type AuthVariables } from '@/middleware/auth'

import { revokeRefreshToken } from '@/lib/token'


const app = new Hono<{ Variables: AuthVariables }>()

// POST /api/users/logout - revoke current device only
app.post('/logout', authMiddleware, async (c) => {
    const { refreshToken } = await c.req.json<{ refreshToken: string }>()

    if (!refreshToken) return c.json({ error: 'Refresh token is required' }, 400)

    await revokeRefreshToken(refreshToken)

    return c.json({ message: 'Logged out successfully' })
})

// POST /api/users/logout-all - revoke all devices
app.post('/logout-all', authMiddleware, async (c) => {
  const currentUserId = c.get('jwtPayload').sub

  await db
    .delete(refreshTokensTable)
    .where(eq(refreshTokensTable.userId, currentUserId))

  return c.json({ message: 'Logged out from all devices successfully' })
})

export default app