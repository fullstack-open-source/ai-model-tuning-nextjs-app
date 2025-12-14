-- Add category field to permissions table
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Create index for category field
CREATE INDEX IF NOT EXISTS "permissions_category_idx" ON "permissions"("category");

