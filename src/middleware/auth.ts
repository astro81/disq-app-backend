import { jwt } from 'hono/jwt'
import type { JwtVariables } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'


export type AuthVariables = JwtVariables

// for protected route
export const authMiddleware: MiddlewareHandler = (c, next) => {
    return jwt({
        secret: process.env.JWT_SECRET!,
        alg: 'HS256',
    })(c, next)
}