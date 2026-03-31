import { sign } from 'hono/jwt'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { refreshTokensTable } from '@/db/schema'

const ACCESS_TOKEN_TTL  = 60 * 30              // 30 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7    // 7 days

export type AccessTokenPayload = {
    sub:  string     // user ID
    type: 'access'
    iat:  number
    exp:  number
}

// Create a short-lived JWT that authorizes API requests
export async function signAccessToken(userId: string): Promise<string> {
    const issuedAt  = Math.floor(Date.now() / 1000)
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL

    return sign(
        {
            sub:  userId,
            type: 'access',
            iat:  issuedAt,
            exp:  expiresAt,
        } satisfies AccessTokenPayload,
        process.env.JWT_SECRET!,
        'HS256',
    )
}

// Generate a random refresh token, hash it, and persist the hash
// The raw (unhashed) token is returned to the caller — never store the raw value
export async function issueRefreshToken(userId: string): Promise<string> {
    const rawToken  = crypto.randomUUID()
    const tokenHash = await hashToken(rawToken)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

    await db.insert(refreshTokensTable).values({ userId, tokenHash, expiresAt })

    return rawToken
}

// Validate a refresh token, delete it (preventing reuse), and issue a new one
// Throws a descriptive error when the token is missing or expired
export async function rotateRefreshToken(
    rawToken: string,
): Promise<{ userId: string; newRefreshToken: string }> {
    const tokenHash   = await hashToken(rawToken)

    const storedToken = await db.query.refreshTokensTable.findFirst({
        where: eq(refreshTokensTable.tokenHash, tokenHash),
    })

    if (!storedToken)
        throw new Error('Refresh token not found. Please sign in again.')

    if (storedToken.expiresAt < new Date()) {
        // Clean up the expired row before rejecting
        await db
            .delete(refreshTokensTable)
            .where(eq(refreshTokensTable.id, storedToken.id))

        throw new Error('Refresh token has expired. Please sign in again.')
    }

    // Delete the used token (rotation prevents replay attacks)
    await db
        .delete(refreshTokensTable)
        .where(eq(refreshTokensTable.id, storedToken.id))

    const newRawToken = await issueRefreshToken(storedToken.userId)

    return { userId: storedToken.userId, newRefreshToken: newRawToken }
}

// Invalidate a specific refresh token (used during logout)
export async function revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = await hashToken(rawToken)

    await db
        .delete(refreshTokensTable)
        .where(eq(refreshTokensTable.tokenHash, tokenHash))
}

// Produce a hex-encoded SHA-256 digest using the Web Crypto API
async function hashToken(rawToken: string): Promise<string> {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(rawToken),
    )

    return Array
        .from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}