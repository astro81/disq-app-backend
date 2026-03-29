import { Hono, type Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { generateState, generateCodeVerifier } from 'arctic'
import { eq, and } from 'drizzle-orm'

import { github, google } from '@/lib/oauth'
import { db } from '@/db'
import { usersTable, oauthAccountsTable } from '@/db/schema'
import { signAccessToken, issueRefreshToken } from '@/lib/token'


const app = new Hono()

const COOKIE_OPTS = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    maxAge: 60 * 15, // 15 min - only needed during the OAuth handshake
}


// GitHub

// GET /api/auth/oauth/github - redirect to GitHub
app.get('/github', (c) => {
    const state = generateState()

    setCookie(c, 'oauth_state', state, COOKIE_OPTS)

    const url = github.createAuthorizationURL(state, ['user:email'])
    return c.redirect(url.toString())
})

// GET /api/auth/oauth/github/callback
app.get('/github/callback', async (c) => {
    const { code, state } = c.req.query()
    const storedState = getCookie(c, 'oauth_state')

    if (!code || !state || !storedState || state !== storedState)
        return c.json({ error: 'Invalid OAuth state' }, 400)

    deleteCookie(c, 'oauth_state', { path: '/' })

    let tokens: Awaited<ReturnType<typeof github.validateAuthorizationCode>>

    try {
        tokens = await github.validateAuthorizationCode(code)
    } catch {
        return c.json({ error: 'Failed to exchange code for token' }, 400)
    }

    // Fetch GitHub user profile
    const profileRes = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
            'User-Agent': 'Disq-App',
        },
    })

    if (!profileRes.ok) return c.json({ error: 'Failed to fetch GitHub profile' }, 502)

    const profile = await profileRes.json() as {
        id: number
        login: string
        name: string | null
        email: string | null
        avatar_url: string
    }

    // GitHub may hide the primary email in the profile - fetch it separately
    let primaryEmail: string | null = profile.email

    if (!primaryEmail) {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${tokens.accessToken()}`,
                'User-Agent': 'Disq-App',
            },
        })
        if (emailsRes.ok) {
            const emails = await emailsRes.json() as Array<{
                email: string
                primary: boolean
                verified: boolean
            }>
            primaryEmail = emails.find(e => e.primary && e.verified)?.email ?? null
        }
    }

    return handleOAuthSignIn(c, {
        provider: 'github',
        providerUserId: String(profile.id),
        email: primaryEmail,
        username: profile.login,
        displayName: profile.name ?? profile.login,
        avatarUrl: profile.avatar_url,
    })
})


// Google

// GET /api/auth/oauth/google - redirect to Google
app.get('/google', (c) => {
    const state = generateState()
    const codeVerifier = generateCodeVerifier()

    setCookie(c, 'oauth_state', state, COOKIE_OPTS)
    setCookie(c, 'oauth_code_verifier', codeVerifier, COOKIE_OPTS)

    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])
    return c.redirect(url.toString())
})

// GET /api/auth/oauth/google/callback
app.get('/google/callback', async (c) => {
    const { code, state } = c.req.query()
    const storedState = getCookie(c, 'oauth_state')
    const storedCodeVerifier = getCookie(c, 'oauth_code_verifier')

    if (!code || !state || !storedState || state !== storedState || !storedCodeVerifier)
        return c.json({ error: 'Invalid OAuth state' }, 400)

    deleteCookie(c, 'oauth_state', { path: '/' })
    deleteCookie(c, 'oauth_code_verifier', { path: '/' })

    let tokens: Awaited<ReturnType<typeof google.validateAuthorizationCode>>
    try {
        tokens = await google.validateAuthorizationCode(code, storedCodeVerifier)
    } catch {
        return c.json({ error: 'Failed to exchange code for token' }, 400)
    }

    // Decode the ID token - avoids an extra /userinfo round-trip
    const idToken = tokens.idToken()
    const payload = JSON.parse(atob(idToken.split('.')[1])) as {
        sub: string
        email: string
        email_verified: boolean
        name: string
        picture: string
    }

    return handleOAuthSignIn(c, {
        provider: 'google',
        providerUserId: payload.sub,
        email: payload.email,
        username: null,           // derived from email below
        displayName: payload.name,
        avatarUrl: payload.picture,
    })
})


// Shared sign-in / sign-up logic 

type OAuthProfile = {
    provider: string
    providerUserId: string
    email: string | null
    username: string | null
    displayName: string
    avatarUrl: string | null
}

async function handleOAuthSignIn(c: Context, profile: OAuthProfile) {
    try {
        // Returning user - oauth_account row already exists
        const existingOAuth = await db.query.oauthAccountsTable.findFirst({
            where: and(
                eq(oauthAccountsTable.provider, profile.provider),
                eq(oauthAccountsTable.providerUserId, profile.providerUserId),
            ),
        })

        let userId: string

        if (existingOAuth) {
            userId = existingOAuth.userId
        } else {
            // Find existing user by email, or create a fresh one
            const existingUser = profile.email
                ? await db.query.usersTable.findFirst({
                    where: eq(usersTable.email, profile.email),
                  })
                : null

            if (existingUser) {
                // Link new provider to the existing account
                userId = existingUser.id
            } else {
                // Brand-new user
                const uniqueUsername = await ensureUniqueUsername(deriveUsername(profile))

                const [newUser] = await db
                    .insert(usersTable)
                    .values({
                        username: uniqueUsername,
                        email: profile.email ?? `${uniqueUsername}@oauth.local`,
                        displayName: profile.displayName,
                        image: profile.avatarUrl,
                    })
                    .returning()

                userId = newUser.id
            }

            // Always create the oauth_account link for new connections
            await db.insert(oauthAccountsTable).values({
                userId,
                provider: profile.provider,
                providerUserId: profile.providerUserId,
                email: profile.email,
            })
        }

        const accessToken = await signAccessToken(userId)
        const refreshToken = await issueRefreshToken(userId)

        // Pass tokens to SvelteKit via query params - the /auth/callback page
        // reads them, sets httpOnly cookies, then redirects to /servers/@me
        const frontendUrl = process.env.FRONTEND_URL!
        const callbackUrl = new URL('/auth/callback', frontendUrl)
        callbackUrl.searchParams.set('accessToken',  accessToken)
        callbackUrl.searchParams.set('refreshToken', refreshToken)

        return c.redirect(callbackUrl.toString())
    } catch (err) {
        console.error('[OAuth] handleOAuthSignIn error:', err)
        const frontendUrl = process.env.FRONTEND_URL!
        return c.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }
}


// Helpers

function deriveUsername(profile: OAuthProfile): string {
    if (profile.username) return sanitizeUsername(profile.username)
    if (profile.email) return sanitizeUsername(profile.email.split('@')[0])
    return sanitizeUsername(profile.displayName)
}

function sanitizeUsername(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/__+/g, '_')
        .replace(/^_+|_+$/g, '')     // trim leading/trailing underscores
        .slice(0, 30)
}

async function ensureUniqueUsername(base: string): Promise<string> {
    let candidate = base
    for (let i = 0; i < 10; i++) {
        const taken = await db.query.usersTable.findFirst({
            where: eq(usersTable.username, candidate),
        })
        if (!taken) return candidate
        candidate = `${base}_${Math.random().toString(36).slice(2, 6)}`
    }
    throw new Error('Could not generate a unique username after 10 attempts')
}

export default app