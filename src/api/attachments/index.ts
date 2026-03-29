import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'
import { ATTACHMENT_ALLOWED_TYPES, UPLOAD_CONSTRAINTS } from '@/lib/upload-constant'
import { uploadAttachmentsToCloudinary } from '@/lib/cloudinary'


const app = new Hono<{ Variables: AuthVariables }>()

// POST /api/attachments
// Body: multipart/form-data { file: File }
app.post('/', authMiddleware, async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || typeof file === 'string')
        return c.json({ error: 'No file provided' }, 400)

    const { maxBytes, folder } = UPLOAD_CONSTRAINTS.attachment

    if (file.size > maxBytes)
        return c.json({ error: `File exceeds ${maxBytes / (1024 * 1024)}MB limit` }, 413)

    if (!(ATTACHMENT_ALLOWED_TYPES as readonly string[]).includes(file.type))
        return c.json({ error: `File type ${file.type} is not allowed` }, 415)

    try {
        const buffer = await file.arrayBuffer()
        const { url, publicId } = await uploadAttachmentsToCloudinary(buffer, file.type, {
            folder,
            maxBytes,
        })

        return c.json({
            url,
            publicId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
        })
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Upload failed'
        return c.json({ error: message }, 500)
    }
})

export default app