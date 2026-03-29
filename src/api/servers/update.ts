import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { serverTable, memberTable } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'
import {
    deleteFromCloudinary,
    extractPublicId,
    uploadToCloudinary,
} from '@/lib/cloudinary'
import { UPLOAD_CONSTRAINTS } from '@/lib/upload-constant'

const app = new Hono<{ Variables: AuthVariables }>()


/** Ensure the caller is at least an ADMIN of the given server. */
async function requireAdmin(serverId: string, userId: string) {
    const membership = await db.query.memberTable.findFirst({
        where: and(
            eq(memberTable.serverId, serverId),
            eq(memberTable.userId, userId),
        ),
        columns: { role: true },
    })
    return membership?.role === 'ADMIN'
}

// PATCH /api/servers/update/:serverId
// Body: multipart/form-data
//   serverName? string
//   serverDescription? string  (send empty string to clear)
//   serverImage? File
//   serverBannerImage? File
//   removeImage? "true"
//   removeBanner? "true"
app.patch('/:serverId', authMiddleware, async (c) => {
    const { serverId } = c.req.param()
    const userId = c.get('jwtPayload').sub

    // authorization 
    const isAdmin = await requireAdmin(serverId, userId)
    if (!isAdmin)
        return c.json({ error: 'Only server admins can edit server settings' }, 403)

    // fetch current server 
    const existing = await db.query.serverTable.findFirst({
        where: eq(serverTable.serverId, serverId),
    })
    if (!existing) return c.json({ error: 'Server not found' }, 404)

    // parse multipart body 
    const body = await c.req.parseBody()

    const serverName = typeof body['serverName'] === 'string' ? body['serverName'].trim() : undefined
    const serverDescription = typeof body['serverDescription'] === 'string' ? body['serverDescription'].trim() : undefined
    const isPrivateServer = typeof body['isPrivateServer'] === 'string' ? body['isPrivateServer'] === 'true' : undefined
    const removeImage = body['removeImage'] === 'true'
    const removeBanner = body['removeBanner'] === 'true'
    const imageFile = body['serverImage'] instanceof File ? body['serverImage'] : null
    const bannerFile = body['serverBannerImage'] instanceof File ? body['serverBannerImage'] : null

    // image upload / removal
    let newImageUrl: string | null | undefined = undefined          // undefined = no change
    let newBannerUrl: string | null | undefined = undefined

    // Server icon
    if (removeImage) {
        if (existing.serverImageUrl) {
            const pid = extractPublicId(existing.serverImageUrl)
            if (pid) await deleteFromCloudinary(pid)
        }
        newImageUrl = null
    } else if (imageFile) {
        if (existing.serverImageUrl) {
            const pid = extractPublicId(existing.serverImageUrl)
            if (pid) await deleteFromCloudinary(pid)
        }
        try {
            const buffer = await imageFile.arrayBuffer()
            const { url } = await uploadToCloudinary(buffer, imageFile.type, {
                folder: UPLOAD_CONSTRAINTS.serverImage.folder,
                maxBytes: UPLOAD_CONSTRAINTS.serverImage.maxBytes,
            })
            newImageUrl = url
        } catch (err: any) {
            return c.json({ error: err.message ?? 'Server image upload failed' }, 422)
        }
    }

    // Banner
    if (removeBanner) {
        if (existing.serverBannerImageUrl) {
            const pid = extractPublicId(existing.serverBannerImageUrl)
            if (pid) await deleteFromCloudinary(pid)
        }
        newBannerUrl = null
    } else if (bannerFile) {
        if (existing.serverBannerImageUrl) {
            const pid = extractPublicId(existing.serverBannerImageUrl)
            if (pid) await deleteFromCloudinary(pid)
        }
        try {
            const buffer = await bannerFile.arrayBuffer()
            const { url } = await uploadToCloudinary(buffer, bannerFile.type, {
                folder: UPLOAD_CONSTRAINTS.serverBanner.folder,
                maxBytes: UPLOAD_CONSTRAINTS.serverBanner.maxBytes,
            })
            newBannerUrl = url
        } catch (err: any) {
            return c.json({ error: err.message ?? 'Banner upload failed' }, 422)
        }
    }

    // build update payload (only changed fields) 
    const updates: Partial<typeof existing> = { updatedAt: new Date() }

    if (serverName !== undefined && serverName.length > 0) updates.serverName = serverName
    if (serverDescription !== undefined) updates.serverDescription = serverDescription || null
    if (isPrivateServer !== undefined) updates.isPrivateServer = isPrivateServer
    if (newImageUrl !== undefined) updates.serverImageUrl = newImageUrl
    if (newBannerUrl !== undefined) updates.serverBannerImageUrl = newBannerUrl

    const [updated] = await db
        .update(serverTable)
        .set(updates)
        .where(eq(serverTable.serverId, serverId))
        .returning()

    return c.json({
        success: true,
        server: {
            serverId: updated.serverId,
            serverName: updated.serverName,
            serverDescription: updated.serverDescription,
            isPrivateServer: updated.isPrivateServer,
            serverImageUrl: updated.serverImageUrl,
            serverBannerImageUrl: updated.serverBannerImageUrl,
            updatedAt: updated.updatedAt,
        },
    })
})

export default app