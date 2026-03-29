import { Hono } from 'hono'
import { db } from '@/db'
import { serverTable, memberTable, channelTable, memberRoleEnum, channelTypeEnum } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { UPLOAD_CONSTRAINTS } from '@/lib/upload-constant'

const app = new Hono<{ Variables: AuthVariables }>()

app.post('/create', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub

    const formData = await c.req.formData()

    const serverName = formData.get('serverName')?.toString().trim()
    const serverDescription = formData.get('serverDescription')?.toString().trim() || null
    const isPrivate = formData.get('isPrivateServer') === 'true'
    const imageFile = formData.get('serverImage') as File | null
    const bannerFile = formData.get('serverBannerImage') as File | null

    if (!serverName) return c.json({ error: 'Server name is required' }, 400)
    if (!imageFile) return c.json({ error: 'Server image is required' }, 400)

    // Upload server image (required)
    let serverImageUrl: string
    try {
        const buffer = await imageFile.arrayBuffer()
        const result = await uploadToCloudinary(buffer, imageFile.type, {
            folder: UPLOAD_CONSTRAINTS.serverImage.folder,
            maxBytes: UPLOAD_CONSTRAINTS.serverImage.maxBytes,
        })
        serverImageUrl = result.url
    } catch (err: any) {
        return c.json({ error: err.message ?? 'Failed to upload server image' }, 422)
    }

    // Upload banner image (optional)
    let serverBannerImageUrl: string | null = null
    if (bannerFile && bannerFile.size > 0) {
        try {
            const buffer = await bannerFile.arrayBuffer()
            const result = await uploadToCloudinary(buffer, bannerFile.type, {
                folder: UPLOAD_CONSTRAINTS.serverBanner.folder,
                maxBytes: UPLOAD_CONSTRAINTS.serverBanner.maxBytes,
            })
            serverBannerImageUrl = result.url
        } catch (err: any) {
            return c.json({ error: err.message ?? 'Failed to upload banner image' }, 422)
        }
    }

    const inviteCode = crypto.randomUUID()

    try {
        const [server] = await db
            .insert(serverTable)
            .values({
                serverName,
                serverImageUrl,
                serverBannerImageUrl,
                serverDescription,
                serverInviteCode: inviteCode,
                isPrivateServer: isPrivate,
                createdBy: currentUserId,
            })
            .returning()
        
        await db.insert(memberTable).values({
            serverId: server.serverId,
            userId: currentUserId,
            role: memberRoleEnum.enumValues[0], // ADMIN
        })

        await db.insert(channelTable).values({
            channelName: 'general',
            channelType: channelTypeEnum.enumValues[0], // TEXT
            position: 1,
            createdBy: currentUserId,
            serverId: server.serverId,
            isPrivateChannel: false,
        })

        return c.json({ message: 'Server created', server }, 201)
    } catch (err: any) {
        if (err.message?.includes('unique')) {
            return c.json({ error: 'A server with that name already exists', field: 'serverName' }, 409)
        }
        return c.json({ error: 'Failed to create server' }, 500)
    }
})

export default app