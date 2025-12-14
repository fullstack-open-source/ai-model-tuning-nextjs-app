-- AlterTable: Add missing user fields
-- This migration adds all the missing fields that are used in the codebase

-- Add user_name field
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_name" TEXT;

-- Add user_type field
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_type" TEXT DEFAULT 'customer';

-- Add is_email_verified field (alias for email_verified)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_email_verified" BOOLEAN DEFAULT false;

-- Add email_verified_at timestamp
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(6);

-- Add is_phone_verified field (alias for phone_verified)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_phone_verified" BOOLEAN DEFAULT false;

-- Add phone_number_verified_at timestamp
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number_verified_at" TIMESTAMP(6);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "users_user_name_idx" ON "users"("user_name");
CREATE INDEX IF NOT EXISTS "users_user_type_idx" ON "users"("user_type");
CREATE INDEX IF NOT EXISTS "users_is_email_verified_idx" ON "users"("is_email_verified");
CREATE INDEX IF NOT EXISTS "users_is_phone_verified_idx" ON "users"("is_phone_verified");

-- Sync is_email_verified with email_verified (if email_verified exists and is_email_verified is null)
UPDATE "users" SET "is_email_verified" = "email_verified" WHERE "email_verified" IS NOT NULL AND "is_email_verified" IS NULL;

-- Sync is_phone_verified with phone_verified (if phone_verified exists and is_phone_verified is null)
UPDATE "users" SET "is_phone_verified" = "phone_verified" WHERE "phone_verified" IS NOT NULL AND "is_phone_verified" IS NULL;

