import { Hono } from 'hono'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { usersTable } from '@/db/schema'

import { authMiddleware, type AuthVariables } from '@/middleware/auth'

import logout from '@/api/users/logout'
import update from '@/api/users/update'
import remove from '@/api/users/delete'


const app = new Hono<{ Variables: AuthVariables }>()

//! internally protected via authMiddleware
app.route('/', logout)  
app.route('/', update)   
app.route('/', remove)   

// Protected routes
app.use('/*', authMiddleware)

// GET /api/users
app.get('/', async (c) => {
    const all = await db.query.usersTable.findMany()
    return c.json(all)
})


// GET /api/users/me - return full user record from DB
app.get('/me', async (c) => {
    const userId = c.get('jwtPayload').sub
 
    const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
    })
    if (!user) return c.json({ error: 'User not found' }, 404)
 
    return c.json({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        image: user.image,
        profileBannerImage: user.profileBannerImage,
    })
})


// GET /api/users/:id
app.get('/:id', async (c) => {
    const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, c.req.param('id')),
    })

    if (!user) return c.json({ error: 'User not found' }, 404)
    return c.json(user)
})

export default app