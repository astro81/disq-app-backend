import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { memberTable, type memberRoleEnum } from '@/db/schema'
import type { Context } from 'hono'
import type { AuthVariables } from '@/middleware/auth'

export type MemberRole = typeof memberRoleEnum.enumValues[number] // 'ADMIN' | 'MODERATOR' | 'GUEST'

type RoleContext = Context<{ Variables: AuthVariables }>

/**
 * Returns the current user's membership row for a given server,
 * or null if they are not a member.
 */
export async function getMembership(c: RoleContext, serverId: string) {
    const userId = c.get('jwtPayload').sub

    return db.query.memberTable.findFirst({
        where: and(
            eq(memberTable.userId, userId),
            eq(memberTable.serverId, serverId),
        ),
    })
}

/**
 * Returns true if the role has at least the required level.
 * Hierarchy: ADMIN > MODERATOR > GUEST
 */
export function hasRole(role: MemberRole, required: MemberRole): boolean {
    const levels: Record<MemberRole, number> = { ADMIN: 2, MODERATOR: 1, GUEST: 0 }
    return levels[role] >= levels[required]
}

export const GENERAL_CHANNEL_NAME = 'general'