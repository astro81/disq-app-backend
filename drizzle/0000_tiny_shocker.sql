CREATE TYPE "public"."ChannelType" AS ENUM('TEXT', 'VOICE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."MemberRole" AS ENUM('ADMIN', 'MODERATOR', 'GUEST');--> statement-breakpoint
CREATE TABLE "channel_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel" (
	"channel_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_name" varchar(255) NOT NULL,
	"type" "ChannelType" DEFAULT 'TEXT' NOT NULL,
	"position" integer NOT NULL,
	"is_private_channel" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"server_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"conversation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_one_id" uuid NOT NULL,
	"member_two_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_message" (
	"direct_message_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direct_message_content" text NOT NULL,
	"message_file_id" uuid,
	"member_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direct_message_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"member_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "MemberRole" DEFAULT 'GUEST' NOT NULL,
	"user_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_file" (
	"message_file_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_file_url" text NOT NULL,
	"message_file_name" text NOT NULL,
	"message_file_public_id" text NOT NULL,
	"message_file_size" integer,
	"message_file_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"message_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_content" text NOT NULL,
	"member_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"message_file_id" uuid,
	"message_deleted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "server" (
	"server_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_name" varchar(255) NOT NULL,
	"server_image_url" text NOT NULL,
	"server_banner_image_url" text,
	"server_description" text,
	"invite_code" text NOT NULL,
	"is_private_server" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "server_server_name_unique" UNIQUE("server_name"),
	CONSTRAINT "server_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"display_name" text NOT NULL,
	"profile_banner_image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_name_unique" UNIQUE("name"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "channel_access" ADD CONSTRAINT "channel_access_channel_id_channel_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("channel_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "channel_access" ADD CONSTRAINT "channel_access_member_id_member_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "channel" ADD CONSTRAINT "channel_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel" ADD CONSTRAINT "channel_server_id_server_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("server_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_member_one_id_member_member_id_fk" FOREIGN KEY ("member_one_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_member_two_id_member_member_id_fk" FOREIGN KEY ("member_two_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_message_file_id_message_file_message_file_id_fk" FOREIGN KEY ("message_file_id") REFERENCES "public"."message_file"("message_file_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_member_id_member_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_conversation_id_conversation_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("conversation_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_server_id_server_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("server_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_member_id_member_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_channel_id_channel_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("channel_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_message_file_id_message_file_message_file_id_fk" FOREIGN KEY ("message_file_id") REFERENCES "public"."message_file"("message_file_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server" ADD CONSTRAINT "server_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "channel_access_channel_idx" ON "channel_access" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "channel_access_member_idx" ON "channel_access" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_access_unique" ON "channel_access" USING btree ("channel_id","member_id");--> statement-breakpoint
CREATE INDEX "channels_created_by_idx" ON "channel" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "channels_server_idx" ON "channel" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "channel_server_type_idx" ON "channel" USING btree ("server_id","type");--> statement-breakpoint
CREATE INDEX "channels_position_idx" ON "channel" USING btree ("server_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_unique_name_per_server" ON "channel" USING btree ("server_id","channel_name");--> statement-breakpoint
CREATE INDEX "conversation_member_one_idx" ON "conversation" USING btree ("member_one_id");--> statement-breakpoint
CREATE INDEX "conversation_member_two_idx" ON "conversation" USING btree ("member_two_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_unique_members" ON "conversation" USING btree ("member_one_id","member_two_id");--> statement-breakpoint
CREATE INDEX "direct_message_member_idx" ON "direct_message" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "direct_message_conversation_idx" ON "direct_message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "members_profile_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "members_server_idx" ON "member" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "members_user_server_idx" ON "member" USING btree ("user_id","server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_unique_user_server" ON "member" USING btree ("user_id","server_id");--> statement-breakpoint
CREATE INDEX "message_file_size_idx" ON "message_file" USING btree ("message_file_size");--> statement-breakpoint
CREATE INDEX "message_file_name" ON "message_file" USING btree ("message_file_name");--> statement-breakpoint
CREATE INDEX "message_file_public_id" ON "message_file" USING btree ("message_file_public_id");--> statement-breakpoint
CREATE INDEX "message_file_url" ON "message_file" USING btree ("message_file_url");--> statement-breakpoint
CREATE INDEX "messages_channel_idx" ON "message" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "messages_member_idx" ON "message" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "messages_channel_message_idx" ON "message" USING btree ("channel_id","message_id");--> statement-breakpoint
CREATE INDEX "messages_channel_not_deleted_idx" ON "message" USING btree ("channel_id","message_deleted");--> statement-breakpoint
CREATE INDEX "messages_file_idx" ON "message" USING btree ("message_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_user_idx" ON "oauth_account" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "server_creator_idx" ON "server" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "username_idx" ON "user" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "email_idx" ON "user" USING btree ("email");