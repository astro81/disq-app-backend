import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations, Table } from "drizzle-orm";
import { channelTable, memberTable } from "@/db/server";


export const messageTable = pgTable("message", {
    messageId: uuid("message_id").defaultRandom().primaryKey(),
    messageContent: text("message_content").notNull(),

    memberId: uuid("member_id").notNull().references(() => memberTable.memberId, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),

    channelId: uuid("channel_id").notNull().references(() => channelTable.channelId, {
        onDelete: "cascade",
        onUpdate: "cascade"
    }),

    messageFileId: uuid("message_file_id").references(() => messageFileTable.messageFileId, {
        onDelete: "cascade",
        onUpdate: "cascade"
    }),

    messageDeleted: boolean("message_deleted").default(false),          // soft delete

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("messages_channel_idx").on(table.channelId),
    index("messages_member_idx").on(table.memberId),
    index("messages_channel_message_idx").on(table.channelId, table.messageId),
    index("messages_channel_not_deleted_idx").on(table.channelId, table.messageDeleted),
    index("messages_file_idx").on(table.messageFileId), // Index for file lookups
]);


export const messageFileTable = pgTable("message_file", {
    messageFileId: uuid("message_file_id").defaultRandom().primaryKey(),
    messageFileUrl: text("message_file_url").notNull(),
    messageFileName: text("message_file_name").notNull(),
    messageFilePublicId: text("message_file_public_id").notNull(),
    messageFileSize: integer("message_file_size"),
    messageFileType: text("message_file_type"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("message_file_size_idx").on(table.messageFileSize),
    index("message_file_name").on(table.messageFileName),
    index("message_file_public_id").on(table.messageFilePublicId),
    index("message_file_url").on(table.messageFileUrl)
])


export const conversationTable = pgTable("conversation", {
    conversationId: uuid("conversation_id").defaultRandom().primaryKey(),

    memberOneId: uuid("member_one_id").notNull().references(() => memberTable.memberId, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),

    memberTwoId: uuid("member_two_id").notNull().references(() => memberTable.memberId, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("conversation_member_one_idx").on(table.memberOneId),
    index("conversation_member_two_idx").on(table.memberTwoId),

    uniqueIndex("conversation_unique_members").on(table.memberOneId, table.memberTwoId),
]);


export const directMessageTable = pgTable("direct_message", {
    directMessageId: uuid("direct_message_id").defaultRandom().primaryKey(),

    directMessageContent: text("direct_message_content").notNull(),
    
    directMessageFileId: uuid("message_file_id").references(() => messageFileTable.messageFileId, {
        onDelete: "cascade",
        onUpdate: "cascade"
    }),

    memberId: uuid("member_id").notNull().references(() => memberTable.memberId, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),

    conversationId: uuid("conversation_id").notNull().references(() => conversationTable.conversationId, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),

    directMessageDeleted: boolean("direct_message_deleted").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
  index("direct_message_member_idx").on(table.memberId),
  index("direct_message_conversation_idx").on(table.conversationId),
]);


export const messageRelations = relations(messageTable, ({ one }) => ({
    member: one(memberTable, {
        fields: [messageTable.memberId],
        references: [memberTable.memberId]
    }),
    channel: one(channelTable, {
        fields: [messageTable.channelId],
        references: [channelTable.channelId]
    }),
    file: one(messageFileTable, {
        fields: [messageTable.messageFileId],
        references: [messageFileTable.messageFileId]
    })
}));


export const messageFileRelations = relations(messageFileTable, ({ one }) => ({
    message: one(messageTable, {
        fields: [messageFileTable.messageFileId],
        references: [messageTable.messageFileId]
    }),
    directMessage: one(directMessageTable, {
        fields: [messageFileTable.messageFileId],
        references: [directMessageTable.directMessageFileId]
    })
}));


export const conversationRelations = relations(conversationTable, ({ one }) => ({
    memberOne: one(memberTable, {
        fields: [conversationTable.memberOneId],
        references: [memberTable.memberId],
        relationName: "member_one",
    }),

    memberTwo: one(memberTable, {
        fields: [conversationTable.memberTwoId],
        references: [memberTable.memberId],
        relationName: "member_two",
    }),
}))


export const directMessageRelations = relations(directMessageTable, ({ one }) => ({
    member: one(memberTable, {
        fields: [directMessageTable.memberId],
        references: [memberTable.memberId],
    }),

    conversation: one(conversationTable, {
        fields: [directMessageTable.conversationId],
        references: [conversationTable.conversationId],
    }),

    file: one(messageFileTable, {
        fields: [directMessageTable.directMessageFileId],
        references: [messageFileTable.messageFileId]
    })
}));



export type Message = typeof messageTable.$inferSelect;
export type MessageFile = typeof messageFileTable.$inferSelect;
export type Conversation = typeof conversationTable.$inferSelect;
export type DirectMessage = typeof directMessageTable.$inferSelect;