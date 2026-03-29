import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";


export const usersTable = pgTable("user", {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("name").notNull().unique(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    
    image: text("image"),
    displayName: text("display_name").notNull(),
    profileBannerImage: text("profile_banner_image"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
	uniqueIndex("username_idx").on(table.username),
	uniqueIndex("email_idx").on(table.email)
]);

export const credentialsTable = pgTable("credential", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => usersTable.id, { onDelete: "cascade" }),
    
    passwordHash: text("password_hash").notNull(),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const refreshTokensTable = pgTable("refresh_token", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => usersTable.id, { onDelete: "cascade" }),
    
    tokenHash: text("token_hash").notNull().unique(), 
    
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const oauthAccountsTable = pgTable("oauth_account", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),               // "google" | "github"
    providerUserId: text("provider_user_id").notNull(),       // ID from the provider
    email: text("email"),                            // email from provider
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    uniqueIndex("oauth_provider_user_idx").on(table.provider, table.providerUserId),
])


export const usersRelations = relations(usersTable, ({ one }) => ({
    credential: one(credentialsTable, {
        fields: [usersTable.id],
        references: [credentialsTable.userId],
    }),
}));

export const credentialsRelations = relations(credentialsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [credentialsTable.userId],
        references: [usersTable.id],
    }),
}));

export const refreshTokensRelations = relations(refreshTokensTable, ({ one }) => ({
    user: one(usersTable, { 
        fields: [refreshTokensTable.userId], 
        references: [usersTable.id] 
    }),
}));

export const oauthAccountsRelations = relations(oauthAccountsTable, ({ one }) => ({
    user: one(usersTable, { 
        fields: [oauthAccountsTable.userId], 
        references: [usersTable.id] 
    }),
}));

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type Credential = typeof credentialsTable.$inferSelect;
export type RefreshToken = typeof refreshTokensTable.$inferSelect;
export type OAuthAccount = typeof oauthAccountsTable.$inferSelect
