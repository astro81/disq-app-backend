import { Hono, type Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { generateState, generateCodeVerifier } from 'arctic'
import { eq, and } from 'drizzle-orm'

import { github, google } from '@/lib/oauth'
import { db } from '@/db'
import { usersTable, oauthAccountsTable } from '@/db/schema'
import { signAccessToken, issueRefreshToken } from '@/lib/token'


const app = new Hono()

// Short-lived cookie used only during the OAuth handshake
const COOKIE_OPTS = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    maxAge: 60 * 15,                // 15 min 
}


// GET /api/auth/oauth/github 
// Redirect the browser to GitHub's authorization page
app.get('/github', (c) => {
    const state = generateState()

    setCookie(c, 'oauth_state', state, COOKIE_OPTS)

    const url = github.createAuthorizationURL(state, ['user:email'])
    return c.redirect(url.toString())
})

// GET /api/auth/oauth/github/callback
// GitHub redirects back here with ?code=…&state=…
app.get('/github/callback', async (c) => {
    const { code, state } = c.req.query()
    const storedState = getCookie(c, 'oauth_state')

    // Validate the state parameter to prevent CSRF
    if (!code || !state || !storedState || state !== storedState)
        return c.json({ error: 'Invalid or expired OAuth state. Please try signing in again.' }, 400)

    deleteCookie(c, 'oauth_state', { path: '/' })

    let tokens: Awaited<ReturnType<typeof github.validateAuthorizationCode>>

    try {
        tokens = await github.validateAuthorizationCode(code)
    } catch (err) {
        console.error('[OAuth/GitHub] code exchange failed:', err)
        return c.json({ error: 'Failed to exchange authorization code. Please try again.' }, 400)
    }

    // Fetch the authenticated user's profile
    const profileRes = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
            'User-Agent': 'Disq-App',
        },
    })

    if (!profileRes.ok) {
        console.error('[OAuth/GitHub] profile fetch failed:', profileRes.status)
        return c.json({ error: 'Failed to fetch GitHub profile. Please try again.' }, 502)
    }


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
        } else {
            console.warn('[OAuth/GitHub] email fetch failed:', emailsRes.status)
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

// GET /api/auth/oauth/google
// Redirect the browser to Google's authorization page
app.get('/google', (c) => {
    const state = generateState()
    const codeVerifier = generateCodeVerifier()

    setCookie(c, 'oauth_state', state, COOKIE_OPTS)
    setCookie(c, 'oauth_code_verifier', codeVerifier, COOKIE_OPTS)

    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])
    return c.redirect(url.toString())
})

// GET /api/auth/oauth/google/callback
// Google redirects back here with ?code=…&state=…
app.get('/google/callback', async (c) => {
    const { code, state } = c.req.query()
    const storedState = getCookie(c, 'oauth_state')
    const storedCodeVerifier = getCookie(c, 'oauth_code_verifier')

    // Validate state (CSRF) and ensure the PKCE verifier is present
    if (!code || !state || !storedState || state !== storedState || !storedCodeVerifier)
        return c.json({ error: 'Invalid or expired OAuth state. Please try signing in again.' }, 400)

    deleteCookie(c, 'oauth_state', { path: '/' })
    deleteCookie(c, 'oauth_code_verifier', { path: '/' })

    let tokens: Awaited<ReturnType<typeof google.validateAuthorizationCode>>
    try {
        tokens = await google.validateAuthorizationCode(code, storedCodeVerifier)
    } catch (err) {
        console.error('[OAuth/Google] code exchange failed:', err)
        return c.json({ error: 'Failed to exchange authorization code. Please try again.' }, 400)
    }

    // Decode the signed ID token instead of making an extra /userinfo request
   let payload: {
        sub: string
        email: string
        email_verified: boolean
        name: string
        picture: string
    }
 
    try {
        const idToken = tokens.idToken()
        payload = JSON.parse(atob(idToken.split('.')[1]))
    } catch (err) {
        console.error('[OAuth/Google] ID token decode failed:', err)
        return c.json({ error: 'Failed to read identity token. Please try again.' }, 400)
    }
 
    return handleOAuthSignIn(c, {
        provider: 'google',
        providerUserId: payload.sub,
        email: payload.email,
        username: null,               // derived from email in deriveUsername()
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
        // Check if this provider account has signed in before
        const existingOAuth = await db.query.oauthAccountsTable.findFirst({
            where: and(
                eq(oauthAccountsTable.provider, profile.provider),
                eq(oauthAccountsTable.providerUserId, profile.providerUserId),
            ),
        })

        let userId: string

        if (existingOAuth) {
            // Returning user reuse the linked account
            userId = existingOAuth.userId
        } else {
                // New OAuth connection find an existing user by email or create one            
                const existingUser = profile.email
                ? await db.query.usersTable.findFirst({
                    where: eq(usersTable.email, profile.email),
                  })
                : null

            if (existingUser) {
                // Link new provider to the existing account
                userId = existingUser.id
            } else {
                // Brand-new user - generate a username and insert the row
                const uniqueUsername = await ensureUniqueUsername(deriveUsername(profile))

                const [newUser] = await db
                    .insert(usersTable)
                    .values({
                        username: uniqueUsername,
                        // Fallback email keeps the column non-null for OAuth-only accounts
                        email: profile.email ?? `${uniqueUsername}@oauth.local`,
                        displayName: profile.displayName,
                        image: profile.avatarUrl,
                    })
                    .returning()

                userId = newUser.id
            }

            // Record the provider link so future logins skip user lookup
            await db.insert(oauthAccountsTable).values({
                userId,
                provider: profile.provider,
                providerUserId: profile.providerUserId,
                email: profile.email,
            })
        }

        const accessToken = await signAccessToken(userId)
        const refreshToken = await issueRefreshToken(userId)

        // Hand the tokens to SvelteKit via query params.
        // The /auth/callback page stores them in httpOnly cookies and redirects to /servers/@me.
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

// Pick the best available field to base the username on
function deriveUsername(profile: OAuthProfile): string {
    if (profile.username) return sanitizeUsername(profile.username)
    if (profile.email) return sanitizeUsername(profile.email.split('@')[0])
    return sanitizeUsername(profile.displayName)
}

// Ensure the username contains only lowercase letters, digits, and underscores
function sanitizeUsername(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')   // replace disallowed chars with _
        .replace(/__+/g, '_')           // collapse consecutive underscores
        .replace(/^_+|_+$/g, '')        // strip leading / trailing underscores
        .slice(0, 30)                   // enforce max length
}

// Keep retrying with a random suffix until we find a name that isn't taken
async function ensureUniqueUsername(base: string): Promise<string> {
    let candidate = base
 
    for (let attempt = 0; attempt < 10; attempt++) {
        const taken = await db.query.usersTable.findFirst({
            where: eq(usersTable.username, candidate),
        })
 
        if (!taken) return candidate
 
        candidate = `${base}_${Math.random().toString(36).slice(2, 6)}`
    }
 
    throw new Error('Could not generate a unique username after 10 attempts')
}

export default app