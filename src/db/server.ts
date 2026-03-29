import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { usersTable } from "@/db/user";
import { conversationTable, messageTable } from "@/db/chat";

export const memberRoleEnum = pgEnum("MemberRole", ["ADMIN", "MODERATOR", "GUEST"]);
export const channelTypeEnum = pgEnum("ChannelType", ["TEXT", "VOICE", "VIDEO"]);


export const serverTable = pgTable("server", {
    serverId: uuid("server_id").defaultRandom().primaryKey(),
    serverName: varchar("server_name", { length: 255 }).notNull().unique(),

    serverImageUrl: text("server_image_url").notNull(), // secure_url (full CDN)    
    serverBannerImageUrl: text("server_banner_image_url"),

    serverDescription: text("server_description"),
    
    serverInviteCode: text("invite_code").notNull().unique(),

    isPrivateServer: boolean("is_private_server").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),

    createdBy: uuid("created_by").notNull().references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
    }),
}, (table) => [
    index("server_creator_idx").on(table.createdBy),
]);


export const memberTable = pgTable("member", {
    memberId: uuid("member_id").defaultRandom().primaryKey(),
    role: memberRoleEnum("role").default("GUEST").notNull(),

    userId: uuid("user_id").notNull().references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
    }),
    serverId: uuid("server_id").notNull().references(() => serverTable.serverId, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("members_profile_idx").on(table.userId),
    index("members_server_idx").on(table.serverId),
    index("members_user_server_idx").on(table.userId, table.serverId),
    // A user can't join the same server twice
    uniqueIndex("members_unique_user_server").on(table.userId, table.serverId)
]);


export const channelTable = pgTable("channel", {
    channelId: uuid("channel_id").defaultRandom().primaryKey(),
    channelName: varchar("channel_name", { length: 255 }).notNull(),
    channelType: channelTypeEnum("type").default("TEXT").notNull(),

    position: integer("position").notNull(),

    isPrivateChannel: boolean("is_private_channel").notNull().default(false),

    createdBy: uuid("created_by").references(() => usersTable.id, {
        onDelete: "set null",
    }),
    serverId: uuid("server_id").notNull().references(() => serverTable.serverId, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("channels_created_by_idx").on(table.createdBy),
    index("channels_server_idx").on(table.serverId),
    index("channel_server_type_idx").on(table.serverId, table.channelType),
    index("channels_position_idx").on(table.serverId, table.position),
    uniqueIndex("channel_unique_name_per_server").on(table.serverId, table.channelName),
]);


// Tracks which members have explicit access to private channels.
// Admins and moderators always have access via their role.
// This table is only for GUEST-level members granted access by an admin/moderator.
export const channelAccessTable = pgTable('channel_access', {
    id: uuid('id').defaultRandom().primaryKey(),
 
    channelId: uuid('channel_id').notNull().references(() => channelTable.channelId, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
    }),
    memberId: uuid('member_id').notNull().references(() => memberTable.memberId, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
    }),
 
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('channel_access_channel_idx').on(table.channelId),
    index('channel_access_member_idx').on(table.memberId),
    uniqueIndex('channel_access_unique').on(table.channelId, table.memberId),
])


export const channelsRelations = relations(channelTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [channelTable.createdBy],
        references: [usersTable.id],
    }),
    server: one(serverTable, {
        fields: [channelTable.serverId],
        references: [serverTable.serverId],
    }),
    messages: many(messageTable),
    access: many(channelAccessTable),
}));


export const channelAccessRelations = relations(channelAccessTable, ({ one }) => ({
    channel: one(channelTable, {
        fields: [channelAccessTable.channelId],
        references: [channelTable.channelId],
    }),
    member: one(memberTable, {
        fields: [channelAccessTable.memberId],
        references: [memberTable.memberId],
    }),
}))


export const serversRelations = relations(serverTable, ({ one, many }) => ({
    creator: one(usersTable, {
        fields: [serverTable.createdBy],
        references: [usersTable.id],
        relationName: "server_creator",
    }),
    members: many(memberTable),
    channels: many(channelTable),
}));


export const membersRelations = relations(memberTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [memberTable.userId],
        references: [usersTable.id],
    }),
    server: one(serverTable, {
        fields: [memberTable.serverId],
        references: [serverTable.serverId],
    }),
    messages: many(messageTable),

    channelAccess: many(channelAccessTable),

    conversationsInitiated: many(conversationTable, {
        relationName: "member_one",
    }),
    conversationsReceived: many(conversationTable, {
        relationName: "member_two",
    }),
}));


export type Server = typeof serverTable.$inferSelect;
export type Channel = typeof channelTable.$inferSelect;
export type Member = typeof memberTable.$inferSelect;
export type ChannelAccess = typeof channelAccessTable.$inferSelect
