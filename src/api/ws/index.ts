// ws/index.ts
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { channelManager } from './helpers/channel-manager'
import { messagePersister } from './helpers/message-persister'
import { messageBuilder } from './helpers/message-builder'
import { clientParser } from './helpers/client-parser'
import { ClientMeta } from './helpers/websocket.types'

const ws = new Hono()

ws.get('/ws/channel/:channelId', upgradeWebSocket((c) => {
    const channelId = c.req.param('channelId')
    if (!channelId) return {}

    const clientData = clientParser.parseFromQuery(c)
    let clientMeta: ClientMeta | null = null

    return {
        onOpen(_, wsClient) {
            clientMeta = clientParser.createClient(wsClient.raw, clientData)

            channelManager.addClient(channelId, clientMeta)

            console.log(`[WS] ${clientMeta.displayName} joined channel: ${channelId}`)
        },

        async onMessage(event) {
            if (!clientMeta) return

            const raw = event.data as string

            const incoming = messageBuilder.parseIncomingPayload(raw)
            
            const { messageId } = await messagePersister.saveMessage(
                channelId,
                clientMeta.memberId,
                incoming
            )

            const outgoing = messageBuilder.buildOutgoingMessage(
                clientMeta,
                channelId,
                incoming,
                messageId
            )

            const serialized = messageBuilder.serializeMessage(outgoing)
            channelManager.broadcastToAll(channelId, serialized)
        },

        onClose() {
            if (clientMeta) {
                channelManager.removeClient(channelId, clientMeta)
                console.log(`[WS] ${clientMeta.displayName} left channel: ${channelId}`)
            }
        },

        onError(error) {
            console.error(`[WS] Error in channel ${channelId}:`, error)
        },
    }
}))

export default ws