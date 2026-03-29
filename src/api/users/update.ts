import { Hono } from 'hono'
import { eq, and, or, ne } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'
import { deleteFromCloudinary, extractPublicId, uploadToCloudinary } from '@/lib/cloudinary'
import { UPLOAD_CONSTRAINTS } from '@/lib/upload-constant'


const app = new Hono<{ Variables: AuthVariables }>()


// PATCH /api/users/me - update text profile fields
app.patch('/me', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub

    const { 
        username, 
        email, 
        displayName 
    } = await c.req.json<{
        username?: string
        email?: string
        displayName?: string
    }>()

    if (!username && !email && !displayName)
        return c.json({ error: 'No fields provided to update' }, 400)

    if (username || email) {
        const conflict = await db.query.usersTable.findFirst({
            where: and(
                ne(usersTable.id, currentUserId),
                or(
                    username ? eq(usersTable.username, username) : undefined,
                    email ? eq(usersTable.email, email) : undefined,
                )
            ),
        })

        if (conflict?.username === username) return c.json({ error: 'Username is already taken' }, 409)
        if (conflict?.email === email) return c.json({ error: 'Email is already registered' }, 409)
    }

    const [updatedUser] = await db
        .update(usersTable)
        .set({
            ...(username && { username }),
            ...(email && { email }),
            ...(displayName && { displayName }),
        })
        .where(eq(usersTable.id, currentUserId))
        .returning()

    return c.json({
        message: 'Profile updated',
        user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
        },
    })
})


// PATCH /api/users/me/avatar - upload avatar via multipart
// Receives multipart/form-data with a single "file" field.
// Uploads to Cloudinary server-side and saves the resulting URL.
app.patch('/me/avatar', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub
 
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
 
    if (!file) return c.json({ error: 'No file provided' }, 400)
 
    // Delete old avatar from Cloudinary before uploading the new one
    const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, currentUserId),
    })

    if (existing?.image) {
        const oldPublicId = extractPublicId(existing.image)
        if (oldPublicId) await deleteFromCloudinary(oldPublicId)
    }
 
    let url: string
    try {
        const buffer = await file.arrayBuffer()
        ;({ url } = await uploadToCloudinary(buffer, file.type, {
            folder: UPLOAD_CONSTRAINTS.avatar.folder,
            publicId: `avatar-${currentUserId}`,  // overwrite on re-upload
            maxBytes: UPLOAD_CONSTRAINTS.avatar.maxBytes,            // 8 MB limit for avatars
        }))
    } catch (err: any) {
        return c.json({ error: err.message ?? 'Upload failed' }, 422)
    }
 
    const [updated] = await db
        .update(usersTable)
        .set({ image: url })
        .where(eq(usersTable.id, currentUserId))
        .returning()
 
    return c.json({ message: 'Avatar updated', imageUrl: updated.image })
})
 
// PATCH /api/users/me/banner - upload banner via multipart
app.patch('/me/banner', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub
 
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
 
    if (!file) return c.json({ error: 'No file provided' }, 400)
 
    const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, currentUserId),
    })

    if (existing?.profileBannerImage) {
        const oldPublicId = extractPublicId(existing.profileBannerImage)
        if (oldPublicId) await deleteFromCloudinary(oldPublicId)
    }
 
    let url: string
    try {
        const buffer = await file.arrayBuffer()
        ;({ url } = await uploadToCloudinary(buffer, file.type, {
            folder: UPLOAD_CONSTRAINTS.banner.folder,
            publicId: `banner-${currentUserId}`,
            maxBytes: UPLOAD_CONSTRAINTS.banner.maxBytes,            // 12 MB limit for banners
        }))
    } catch (err: any) {
        return c.json({ error: err.message ?? 'Upload failed' }, 422)
    }
 
    const [updated] = await db
        .update(usersTable)
        .set({ profileBannerImage: url })
        .where(eq(usersTable.id, currentUserId))
        .returning()
 
    return c.json({ message: 'Banner updated', imageUrl: updated.profileBannerImage })
})
 
// DELETE /api/users/me/avatar
app.delete('/me/avatar', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub
 
    const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, currentUserId),
    })
    
    if (!existing?.image) return c.json({ error: 'No avatar to remove' }, 404)
 
    const publicId = extractPublicId(existing.image)
    
    if (publicId) await deleteFromCloudinary(publicId)
 
    await db.update(usersTable).set({ image: null }).where(eq(usersTable.id, currentUserId))
 
    return c.json({ message: 'Avatar removed' })
})
 
// DELETE /api/users/me/banner
app.delete('/me/banner', authMiddleware, async (c) => {
    const currentUserId = c.get('jwtPayload').sub
 
    const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, currentUserId),
    })

    if (!existing?.profileBannerImage) return c.json({ error: 'No banner to remove' }, 404)
 
    const publicId = extractPublicId(existing.profileBannerImage)

    if (publicId) await deleteFromCloudinary(publicId)
 
    await db.update(usersTable).set({ profileBannerImage: null }).where(eq(usersTable.id, currentUserId))
 
    return c.json({ message: 'Banner removed' })
})

export default app