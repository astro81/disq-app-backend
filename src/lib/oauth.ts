import { GitHub, Google } from 'arctic'

const origin = process.env.ORIGIN! 

export const github = new GitHub(
    process.env.GITHUB_CLIENT_ID!,
    process.env.GITHUB_CLIENT_SECRET!,
    `${origin}/api/auth/oauth/github/callback`
)

export const google = new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${origin}/api/auth/oauth/google/callback`
)