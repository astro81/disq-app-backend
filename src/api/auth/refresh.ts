import { Hono } from 'hono'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable } from '@/db/schema'

import { rotateRefreshToken, signAccessToken } from '@/lib/token'


const app = new Hono()

app.post('/refresh', async (c) => {
    const { refreshToken } = await c.req.json<{ refreshToken: string }>()

    if (!refreshToken) return c.json({ error: 'Refresh token is required' }, 400)

    let userId: string
    let newRefreshToken: string

    try {
        ({ userId, newRefreshToken } = await rotateRefreshToken(refreshToken))
    } catch (e: any) {
        return c.json({ error: e.message ?? 'Invalid refresh token' }, 401)
    }

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) })
    if (!user) return c.json({ error: 'User not found' }, 401)

    const accessToken = await signAccessToken(user.id)

    return c.json({ accessToken, refreshToken: newRefreshToken })
})

export default app