// ws/websocket.types.ts
import type { ServerWebSocket } from 'bun'

export type ClientMeta = {
    ws: ServerWebSocket
    memberId: string
    userId: string
    username: string
    displayName: string
    userProfileImage?: string | null
    userBannerImage?: string | null
    role?: string | null 
}

export type IncomingPayload = {
    text: string
    fileUrl?: string
    fileName?: string
    filePublicId?: string
    fileSize?: number
    fileType?: string
}

export type OutgoingMessage = {
    messageId: string | null
    channelId: string
    memberId: string
    userId: string
    message: string
    messageFileUrl?: string | null
    messageFileName?: string | null
    messageFileType?: string | null
    messageFileSize?: number | null
    timestamp: number
    username: string
    displayName: string
    userProfileImage?: string | null
    userBannerImage?: string | null
    role?: string | null
}