import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export { cloudinary }


type UploadOptions = {
    folder: string
    publicId?: string   // use userId so re-uploads overwrite the same asset
    maxBytes?: number
}

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure_url and public_id.
 */
export async function uploadToCloudinary(
    fileBuffer: ArrayBuffer,
    mimeType: string,
    options: UploadOptions,
): Promise<{ url: string; publicId: string }> {
    const { folder, publicId, maxBytes = 8 * 1024 * 1024 } = options

    if (fileBuffer.byteLength > maxBytes)
        throw new Error(`File exceeds the ${maxBytes / (1024 * 1024)}MB limit`)

    if (!mimeType.startsWith('image/'))
        throw new Error('Only image files are allowed')

    // Cloudinary Node SDK accepts base64 data URIs
    const b64 = Buffer.from(fileBuffer).toString('base64')
    const dataUri = `data:${mimeType};base64,${b64}`

    const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        ...(publicId && { public_id: publicId, overwrite: true }),
        resource_type: 'image',
    })

    return { url: result.secure_url, publicId: result.public_id }
}


/**
 * Upload an attachment (Image, Video, or Raw file) to Cloudinary.
 */
export async function uploadAttachmentsToCloudinary(
    fileBuffer: ArrayBuffer,
    mimeType: string,
    options: { folder: string; maxBytes: number }
): Promise<{ url: string; publicId: string }> {
    const { folder, maxBytes } = options

    if (fileBuffer.byteLength > maxBytes) {
        throw new Error(`File exceeds the ${maxBytes / (1024 * 1024)}MB limit`)
    }

    // Convert Buffer to Base64
    const b64 = Buffer.from(fileBuffer).toString('base64')
    const dataUri = `data:${mimeType};base64,${b64}`

    // Use resource_type: 'auto' to let Cloudinary detect if it's a video, image, or raw file (zip, pdf, etc.)
    const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: 'auto', 
    })

    return { 
        url: result.secure_url, 
        publicId: result.public_id 
    }
}


// Delete a Cloudinary asset by public_id. Silently ignores errors.
export async function deleteFromCloudinary(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId).catch(() => null)
}


/**
 * Extract the Cloudinary public_id from a secure_url.
 * "https://res.cloudinary.com/cloud/image/upload/v123/disq/avatars/user-abc.jpg"
 * "disq/avatars/user-abc"
 */
export function extractPublicId(url: string): string | null {
    try {
        const { pathname } = new URL(url)
        const idx = pathname.indexOf('/upload/')
        if (idx === -1) return null
        let rest = pathname.slice(idx + '/upload/'.length)
        rest = rest.replace(/^v\d+\//, '')  // strip version segment
        rest = rest.replace(/\.[^.]+$/, '') // strip extension
        return rest || null
    } catch {
        return null
    }
}