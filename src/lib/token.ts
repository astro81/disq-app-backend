import { sign } from 'hono/jwt'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { refreshTokensTable } from '@/db/schema'


const ACCESS_TOKEN_TTL = 60 * 30            // 30 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7  // 7 days


export type AccessTokenPayload = {
    sub: string              // claim via userId
    type: 'access'
    iat: number
    exp: number
}


// Sign a short-lived access token
export async function signAccessToken(userId: string) {    
    const issuedAt  = Math.floor(Date.now() / 1000)
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL

    return sign(
        {
            sub: userId,
            type: 'access',
            iat: issuedAt,
            exp: expiresAt
        } satisfies AccessTokenPayload,
        process.env.JWT_SECRET!,
        'HS256'
    )
}

// Issue + persist a refresh token
export async function issueRefreshToken(userId: string) {
    
    // Raw token = random UUID (not a JWT)
    const rawToken = crypto.randomUUID()
    const tokenHash = await hashToken(rawToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

    await db
        .insert(refreshTokensTable)
        .values({ userId, tokenHash, expiresAt })

    return rawToken  // send this to the client, don't store raw value
}

// Rotate: validate old refresh token, issue new one
export async function rotateRefreshToken(rawToken: string) {
    const hashedToken = await hashToken(rawToken)

    const storedToken = await db.query.refreshTokensTable.findFirst({
        where: eq(refreshTokensTable.tokenHash, hashedToken),
    })

    if (!storedToken) throw new Error('Invalid refresh token')
    
    if (storedToken.expiresAt < new Date()) {
        // Clean up expired token
        await db
            .delete(refreshTokensTable)
            .where(eq(refreshTokensTable.id, storedToken.id))

        throw new Error('Refresh token expired')
    }

    // Rotate: delete old, issue new (prevents reuse)
    await db
        .delete(refreshTokensTable)
        .where(eq(refreshTokensTable.id, storedToken.id))
   
    const newRawToken = await issueRefreshToken(storedToken.userId)

    return { userId: storedToken.userId, newRefreshToken: newRawToken }
}

// Revoke a specific refresh token (logout)
export async function revokeRefreshToken(rawToken: string) {
    const tokenHash = await hashToken(rawToken)
    await db
        .delete(refreshTokensTable)
        .where(eq(refreshTokensTable.tokenHash, tokenHash))
}


// SHA-256 hash using Web Crypto
async function hashToken(rawToken: string) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken))
    
    return Array
        .from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0')).join('')
}