-- Account Sharing Module Migration
-- Add tables for account sharing functionality

-- Create account_share table
CREATE TABLE IF NOT EXISTS "account_share" (
    "share_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "shared_user_id" UUID NOT NULL,
    "access_level" VARCHAR(20) NOT NULL DEFAULT 'view_only',
    "custom_permissions" JSONB,
    "share_name" VARCHAR(100),
    "share_note" TEXT,
    "expires_at" TIMESTAMP(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed" TIMESTAMP(6),

    CONSTRAINT "account_share_pkey" PRIMARY KEY ("share_id")
);

-- Create unique constraint for owner_id and shared_user_id
ALTER TABLE "account_share" ADD CONSTRAINT "account_share_owner_id_shared_user_id_key" UNIQUE ("owner_id", "shared_user_id");

-- Create indexes for account_share
CREATE INDEX IF NOT EXISTS "account_share_owner_id_idx" ON "account_share"("owner_id");
CREATE INDEX IF NOT EXISTS "account_share_shared_user_id_idx" ON "account_share"("shared_user_id");
CREATE INDEX IF NOT EXISTS "account_share_status_idx" ON "account_share"("status");
CREATE INDEX IF NOT EXISTS "account_share_is_active_idx" ON "account_share"("is_active");
CREATE INDEX IF NOT EXISTS "account_share_expires_at_idx" ON "account_share"("expires_at");

-- Add foreign keys for account_share
ALTER TABLE "account_share" ADD CONSTRAINT "account_share_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_share" ADD CONSTRAINT "account_share_shared_user_id_fkey" FOREIGN KEY ("shared_user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create account_share_invitation table
CREATE TABLE IF NOT EXISTS "account_share_invitation" (
    "invitation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_id" UUID NOT NULL,
    "invitation_type" VARCHAR(20) NOT NULL DEFAULT 'share',
    "recipient_email" VARCHAR(255),
    "recipient_id" UUID,
    "target_owner_id" UUID,
    "access_level" VARCHAR(20) NOT NULL DEFAULT 'view_only',
    "custom_permissions" JSONB,
    "invitation_token" VARCHAR(100) NOT NULL,
    "message" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(6) NOT NULL,
    "responded_at" TIMESTAMP(6),
    "response_note" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_share_invitation_pkey" PRIMARY KEY ("invitation_id")
);

-- Create unique constraint for invitation_token
ALTER TABLE "account_share_invitation" ADD CONSTRAINT "account_share_invitation_invitation_token_key" UNIQUE ("invitation_token");

-- Create indexes for account_share_invitation
CREATE INDEX IF NOT EXISTS "account_share_invitation_sender_id_idx" ON "account_share_invitation"("sender_id");
CREATE INDEX IF NOT EXISTS "account_share_invitation_recipient_email_idx" ON "account_share_invitation"("recipient_email");
CREATE INDEX IF NOT EXISTS "account_share_invitation_recipient_id_idx" ON "account_share_invitation"("recipient_id");
CREATE INDEX IF NOT EXISTS "account_share_invitation_target_owner_id_idx" ON "account_share_invitation"("target_owner_id");
CREATE INDEX IF NOT EXISTS "account_share_invitation_invitation_token_idx" ON "account_share_invitation"("invitation_token");
CREATE INDEX IF NOT EXISTS "account_share_invitation_status_idx" ON "account_share_invitation"("status");
CREATE INDEX IF NOT EXISTS "account_share_invitation_invitation_type_idx" ON "account_share_invitation"("invitation_type");
CREATE INDEX IF NOT EXISTS "account_share_invitation_expires_at_idx" ON "account_share_invitation"("expires_at");

-- Add foreign keys for account_share_invitation
ALTER TABLE "account_share_invitation" ADD CONSTRAINT "account_share_invitation_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_share_invitation" ADD CONSTRAINT "account_share_invitation_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_share_invitation" ADD CONSTRAINT "account_share_invitation_target_owner_id_fkey" FOREIGN KEY ("target_owner_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create account_share_activity table
CREATE TABLE IF NOT EXISTS "account_share_activity" (
    "activity_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "share_id" UUID,
    "owner_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "action_type" VARCHAR(20) NOT NULL DEFAULT 'info',
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "device" VARCHAR(100),
    "browser" VARCHAR(100),
    "location" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_share_activity_pkey" PRIMARY KEY ("activity_id")
);

-- Create indexes for account_share_activity
CREATE INDEX IF NOT EXISTS "account_share_activity_share_id_idx" ON "account_share_activity"("share_id");
CREATE INDEX IF NOT EXISTS "account_share_activity_owner_id_idx" ON "account_share_activity"("owner_id");
CREATE INDEX IF NOT EXISTS "account_share_activity_actor_id_idx" ON "account_share_activity"("actor_id");
CREATE INDEX IF NOT EXISTS "account_share_activity_action_idx" ON "account_share_activity"("action");
CREATE INDEX IF NOT EXISTS "account_share_activity_action_type_idx" ON "account_share_activity"("action_type");
CREATE INDEX IF NOT EXISTS "account_share_activity_created_at_idx" ON "account_share_activity"("created_at");

-- Add foreign keys for account_share_activity
ALTER TABLE "account_share_activity" ADD CONSTRAINT "account_share_activity_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "account_share"("share_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "account_share_activity" ADD CONSTRAINT "account_share_activity_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_share_activity" ADD CONSTRAINT "account_share_activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

