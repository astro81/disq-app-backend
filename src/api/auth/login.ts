import { Hono } from 'hono'
import { eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable, credentialsTable } from '@/db/schema'
import { issueRefreshToken, signAccessToken } from '@/lib/token'

const app = new Hono()

app.post('/login', async (c) => {
    // Parse and validate request body
    let body: { identifier: string; password: string }

    try {
        body = await c.req.json()
    } catch {
        return c.json({ error: 'Request body must be valid JSON' }, 400)
    }

    const { identifier, password } = body

    if (!identifier)
        return c.json({ error: 'Username or email is required', field: 'identifier' }, 400)
    if (!password)
        return c.json({ error: 'Password is required', field: 'password' }, 400)

    try {
        // Accept either a username or an email address
        const user = await db.query.usersTable.findFirst({
            where: or(
                eq(usersTable.username, identifier),
                eq(usersTable.email, identifier),
            ),
        })

        // Use a generic message to avoid leaking whether the account exists
        if (!user)
            return c.json({ error: 'Invalid credentials', field: 'identifier' }, 401)

        const credential = await db.query.credentialsTable.findFirst({
            where: eq(credentialsTable.userId, user.id),
        })

        // User exists but was created via OAuth (no password set)
        if (!credential)
            return c.json(
                { error: 'This account uses social login. Please sign in with GitHub or Google.' },
                401,
            )

        const valid = await Bun.password.verify(password, credential.passwordHash)

        if (!valid)
            return c.json({ error: 'Invalid credentials', field: 'password' }, 401)

        const accessToken  = await signAccessToken(user.id)
        const refreshToken = await issueRefreshToken(user.id)

        return c.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.displayName,
            },
        })
    } catch (err) {
        console.error('[login] unexpected error:', err)
        return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500)
    }
})

export default app