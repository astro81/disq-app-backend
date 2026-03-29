// ws/message-persister.ts
import { db } from '@/db'
import { messageFileTable, messageTable } from '@/db/chat'
import { IncomingPayload } from './websocket.types'

export class MessagePersister {
    async saveMessage(
        channelId: string,
        memberId: string,
        payload: IncomingPayload
    ): Promise<{ messageId: string | null; messageFileId: string | null }> {
        let messageFileId: string | null = null

        try {
            // Save file if present
            if (this.hasFileAttachment(payload)) {
                messageFileId = await this.saveFile(payload)
            }

            // Save message
            const messageId = await this.saveMessageRow(
                channelId,
                memberId,
                payload.text,
                messageFileId
            )

            return { messageId, messageFileId }
        } catch (error) {
            console.error('[WS] Failed to persist message:', error)
            return { messageId: null, messageFileId: null }
        }
    }

    private hasFileAttachment(payload: IncomingPayload): boolean {
        return !!(payload.fileUrl && payload.fileName && payload.filePublicId)
    }

    private async saveFile(payload: IncomingPayload): Promise<string | null> {
        const [savedFile] = await db
            .insert(messageFileTable)
            .values({
                messageFileUrl: payload.fileUrl!,
                messageFileName: payload.fileName!,
                messageFilePublicId: payload.filePublicId!,
                messageFileSize: payload.fileSize ?? null,
                messageFileType: payload.fileType ?? null,
            })
            .returning({ messageFileId: messageFileTable.messageFileId })

        return savedFile.messageFileId
    }

    private async saveMessageRow(
        channelId: string,
        memberId: string,
        content: string,
        fileId: string | null
    ): Promise<string | null> {
        const [savedMessage] = await db
            .insert(messageTable)
            .values({
                channelId,
                memberId,
                messageContent: content,
                ...(fileId ? { messageFileId: fileId } : {}),
            })
            .returning({ messageId: messageTable.messageId })

        return savedMessage.messageId
    }
}

export const messagePersister = new MessagePersister()