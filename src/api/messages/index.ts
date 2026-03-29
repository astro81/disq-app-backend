import { Hono } from 'hono'
import { eq, desc, and, lt } from 'drizzle-orm'
import { db } from '@/db'
import { messageFileTable, messageTable, } from '@/db/chat'
import { channelTable, memberTable, usersTable } from '@/db/schema'
import { authMiddleware, type AuthVariables } from '@/middleware/auth'


const app = new Hono<{ Variables: AuthVariables }>()

const MESSAGE_BATCH = 30


// GET /api/messages/:channelId?cursor=<messageId>
// Returns MESSAGE_BATCH messages, newest first, paginated by cursor
app.get('/:channelId', authMiddleware, async (c) => {
    const channelId = c.req.param('channelId')
    const cursor = c.req.query('cursor') // last messageId from previous page

    if (!channelId) return c.json({ error: 'channelId is required' }, 400)
    
	const userId = c.get('jwtPayload').sub
          
	// Resolve the channel to get its serverId for membership check
  	const channel = await db.query.channelTable.findFirst({
    	where: eq(channelTable.channelId, channelId),
  	})
  	
	if (!channel) return c.json({ error: 'Channel not found' }, 404)

  	// Verify user is a member of the server this channel belongs to
  	const membership = await db.query.memberTable.findFirst({
  	  	where: and(
  	  	  	eq(memberTable.serverId, channel.serverId),
  	  	  	eq(memberTable.userId, userId),
  	  	),
  	})

  	if (!membership) return c.json({ error: 'Forbidden' }, 403)
    
	const conditions = [
        eq(messageTable.channelId, channelId),
        eq(messageTable.messageDeleted, false),
        ...(cursor ? [lt(messageTable.messageId, cursor)] : []),
    ]

    const messages = await db
        .select({
            messageId: messageTable.messageId,
            messageContent: messageTable.messageContent,
            createdAt: messageTable.createdAt,
            updatedAt: messageTable.updatedAt,
            memberId: messageTable.memberId,
            userId: usersTable.id,
            displayName: usersTable.displayName,
            username: usersTable.username,
            userProfileImage: usersTable.image,
			userBannerImage: usersTable.profileBannerImage,
			role: memberTable.role,

            // File attachment columns — null when no file was attached
            messageFileUrl: messageFileTable.messageFileUrl,
            messageFileName: messageFileTable.messageFileName,
            messageFileType: messageFileTable.messageFileType,
            messageFileSize: messageFileTable.messageFileSize
        })
        .from(messageTable)
        .innerJoin(memberTable, eq(messageTable.memberId, memberTable.memberId))
        .innerJoin(usersTable, eq(memberTable.userId, usersTable.id))
        .leftJoin(messageFileTable, eq(messageTable.messageFileId, messageFileTable.messageFileId))            // LEFT join so messages without a file are still returned
        .where(and(...conditions))
        .orderBy(desc(messageTable.createdAt))
        .limit(MESSAGE_BATCH)

    // Return oldest-first so the UI can append in order
    const ordered = messages.reverse()
    const nextCursor = messages.length === MESSAGE_BATCH ? messages[0].messageId : null

    return c.json({ messages: ordered, nextCursor })
})

export default app