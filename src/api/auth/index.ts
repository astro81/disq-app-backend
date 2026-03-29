import { Hono } from 'hono'

import register from '@/api/auth/register'
import login from '@/api/auth/login'
import refresh from '@/api/auth/refresh'
import oauth from '@/api/auth/oauth'

const app = new Hono()

// Public routes
app.route('/', register)
app.route('/', login)
app.route('/', refresh)
app.route('/oauth', oauth)     

export default app