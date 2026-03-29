// ws/message-builder.ts
import { ClientMeta, IncomingPayload, OutgoingMessage } from './websocket.types'

export class MessageBuilder {
    buildOutgoingMessage(
        client: ClientMeta,
        channelId: string,
        payload: IncomingPayload,
        messageId: string | null
    ): OutgoingMessage {
        
        const base: OutgoingMessage = {
            messageId,
            channelId,
            memberId: client.memberId,
            userId: client.userId,
            message: payload.text,
            timestamp: Date.now(),
            username: client.username,
            displayName: client.displayName,
            userProfileImage: client.userProfileImage,
            userBannerImage: client.userBannerImage,
            role: client.role,
        }

        // Add file fields if present
        if (payload.fileUrl) {
            return {
                ...base,
                messageFileUrl: payload.fileUrl,
                messageFileName: payload.fileName ?? null,
                messageFileType: payload.fileType ?? null,
                messageFileSize: payload.fileSize ?? null,
            }
        }

        return base
    }

    serializeMessage(message: OutgoingMessage): string {
        return JSON.stringify(message)
    }

    parseIncomingPayload(raw: string): IncomingPayload {
        try {
            const parsed = JSON.parse(raw)
            
            if (parsed && typeof parsed === 'object' && 'text' in parsed) 
                return parsed as IncomingPayload

            return { text: raw }
        } catch {
            return { text: raw }
        }
    }
}

export const messageBuilder = new MessageBuilder()