import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { rotateRefreshToken, signAccessToken } from '@/lib/token'

const app = new Hono()

app.post('/refresh', async (c) => {
    // Parse and validate request body
    let body: { refreshToken: string }

    try {
        body = await c.req.json()
    } catch {
        return c.json({ error: 'Request body must be valid JSON' }, 400)
    }

    const { refreshToken } = body

    if (!refreshToken)
        return c.json({ error: 'Refresh token is required' }, 400)

    // Validate the old token, delete it, and issue a fresh pair
    // rotateRefreshToken throws a descriptive error on failure
    let userId: string
    let newRefreshToken: string

    try {
        ;({ userId, newRefreshToken } = await rotateRefreshToken(refreshToken))
    } catch (err: any) {
        // Surface the specific reason (expired, not found, etc.)
        return c.json({ error: err.message ?? 'Invalid refresh token' }, 401)
    }

    try {
        const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) })

        if (!user)
            return c.json({ error: 'Account not found. It may have been deleted.' }, 401)

        const accessToken = await signAccessToken(user.id)

        return c.json({ accessToken, refreshToken: newRefreshToken })
    } catch (err) {
        console.error('[refresh] unexpected error:', err)
        return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500)
    }
})

export default app