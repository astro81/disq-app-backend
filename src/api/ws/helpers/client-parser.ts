// ws/client-parser.ts
import { ClientMeta } from './websocket.types'

export class ClientParser {
    parseFromQuery(c: any): Partial<ClientMeta> {
        return {
            memberId: c.req.query('memberId') ?? 'unknown',
            userId: c.req.query('userId') ?? 'unknown',
            
            username: c.req.query('username') ?? 'unknown',
            displayName: c.req.query('displayName') ?? 'Unknown',
            userProfileImage: c.req.query('userProfileImage') ?? null,
            userBannerImage: c.req.query('userBannerImage') ?? null,
            
            role: c.req.query('role') ?? null,
        }
    }

    createClient(ws: any, data: Partial<ClientMeta>): ClientMeta {
        return {
            ws,
            memberId: data.memberId!,
            userId: data.userId!,
            
            username: data.username!,
            displayName: data.displayName!,
            userProfileImage: data.userProfileImage,
            userBannerImage: data.userBannerImage,
            
            role: data.role,
        }
    }
}

export const clientParser = new ClientParser()