// ws/channel-manager.ts
import { ClientMeta } from './websocket.types'

class ChannelManager {
    private channels = new Map<string, Set<ClientMeta>>()

    addClient(channelId: string, client: ClientMeta): void {
        if (!this.channels.has(channelId)) {
            this.channels.set(channelId, new Set())
        }
        this.channels.get(channelId)!.add(client)
    }

    removeClient(channelId: string, client: ClientMeta): void {
        const room = this.channels.get(channelId)
        if (room) {
            room.delete(client)
            if (room.size === 0) {
                this.channels.delete(channelId)
            }
        }
    }

    getRoom(channelId: string): Set<ClientMeta> | undefined {
        return this.channels.get(channelId)
    }

    broadcast(channelId: string, message: string, excludeClient?: ClientMeta): void {
        const room = this.channels.get(channelId)
        if (!room) return

        room.forEach((client) => {
            if (client !== excludeClient && client.ws.readyState === 1) {
                client.ws.send(message)
            }
        })
    }

    broadcastToAll(channelId: string, message: string): void {
        const room = this.channels.get(channelId)
        if (!room) return

        room.forEach((client) => {
            if (client.ws.readyState === 1) {
                client.ws.send(message)
            }
        })
    }
}

export const channelManager = new ChannelManager()