import { Hono } from 'hono'
import { eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable, credentialsTable } from '@/db/schema'
import { issueRefreshToken, signAccessToken } from '@/lib/token'

const app = new Hono()

app.post('/register', async (c) => {
    // Parse and validate request body
    let body: { username: string; email: string; password: string; displayName: string }

    try {
        body = await c.req.json()
    } catch {
        return c.json({ error: 'Request body must be valid JSON' }, 400)
    }

    const { username, email, password, displayName } = body

    if (!username)
        return c.json({ error: 'Username is required', field: 'username' }, 400)
    if (!email)
        return c.json({ error: 'Email is required', field: 'email' }, 400)
    if (!password)
        return c.json({ error: 'Password is required', field: 'password' }, 400)
    if (password.length < 8)
        return c.json({ error: 'Password must be at least 8 characters', field: 'password' }, 400)

    try {
        // Block duplicate username or email before inserting
        const existing = await db.query.usersTable.findFirst({
            where: or(eq(usersTable.username, username), eq(usersTable.email, email)),
        })

        if (existing?.username === username)
            return c.json({ error: 'Username is already taken', field: 'username' }, 409)
        if (existing?.email === email)
            return c.json({ error: 'Email is already registered', field: 'email' }, 409)

        // Hash password with argon2id
        const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' })

        // save user info
        const [newUser] = await db
            .insert(usersTable)
            .values({ username, email, displayName: displayName || username })
            .returning()

        await db.insert(credentialsTable).values({ userId: newUser.id, passwordHash })

        // generate jwt tokens
        const accessToken  = await signAccessToken(newUser.id)
        const refreshToken = await issueRefreshToken(newUser.id)

        return c.json(
            {
                accessToken,
                refreshToken,
                user: { id: newUser.id, username: newUser.username, email: newUser.email },
            },
            201,
        )
    } catch (err) {
        console.error('[register] unexpected error:', err)
        return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500)
    }
})

export default app