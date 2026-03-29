export const UPLOAD_CONSTRAINTS = {
    avatar: {
        maxBytes: 8 * 1024 * 1024,                  
        maxLabel: '8MB',
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        allowedLabel: 'PNG, JPG, WEBP, GIF',
        folder: 'disq/avatars',
    },
    banner: {
        maxBytes: 12 * 1024 * 1024,                 
        maxLabel: '12MB',
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        allowedLabel: 'PNG, JPG, WEBP, GIF',
        folder: 'disq/banners',
    },
    serverImage: {
        maxBytes: 8 * 1024 * 1024,                    
        maxLabel: '8MB',
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        allowedLabel: 'PNG, JPG, WEBP, GIF',
        folder: 'disq/servers',
    },
    serverBanner: {
        maxBytes: 12 * 1024 * 1024,                    
        maxLabel: '12MB',
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        allowedLabel: 'PNG, JPG, WEBP, GIF',
        folder: 'disq/server-banners',
    },
    attachment: {
        maxBytes: 30 * 1024 * 1024,
        maxLabel: '30MB',
        folder: 'disq/attachments',
    },
} as const


export const ATTACHMENT_ALLOWED_TYPES = [
    // images
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
    // video
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
    // documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    // code
    'text/javascript', 'application/javascript',
    'text/typescript',
    'text/css',
    'text/html',
    'text/x-python', 'application/x-python-code',
    'text/x-csharp',
    'text/x-java-source',
    'application/json',
    'application/xml', 'text/xml',
    'text/x-c', 'text/x-c++',
    'text/x-go',
    'text/x-rust',
    'application/x-sh', 'text/x-shellscript',
    'text/markdown',
    // archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
] as const

export type AttachmentType = 'image' | 'video' | 'document' | 'code' | 'archive' | 'other'
