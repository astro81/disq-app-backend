import { Hono } from 'hono'

import { eq, or } from 'drizzle-orm'

import { db } from '@/db'
import { usersTable, credentialsTable } from '@/db/schema'
import { issueRefreshToken, signAccessToken } from '@/lib/token'


const app = new Hono()

app.post('/login', async (c) => {
    const { identifier, password } = await c.req.json<{
        identifier: string   // accepts username OR email
        password: string
    }>()

    if (!identifier) 
        return c.json({ error: 'Username or email is required', field: 'identifier' }, 404)

    if (!password)
        return c.json({ error: 'Password is required', field: 'password' }, 400)
  

    // Find user by username or email 
    const user = await db.query.usersTable.findFirst({
        where: or(
            eq(usersTable.username, identifier),
            eq(usersTable.email, identifier)
        ),
    })

    if (!user)
        return c.json({ error: 'Invalid credentials', field: 'identifier' }, 401)


    // Fetch credentials row 
    const credential = await db.query.credentialsTable.findFirst({
        where: eq(credentialsTable.userId, user.id),
    })

    if (!credential) 
        return c.json({ error: 'Invalid credentials', field: 'identifier' }, 401)
    
    // Verify password 
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
            displayName: user.displayName 
        },
    })

})

export default app