-- Migration: Add parent_job_id to fine_tune_job table for enhancement chain tracking
-- Run this migration manually if prisma migrate doesn't work

-- Add parent_job_id column
ALTER TABLE "fine_tune_job" 
ADD COLUMN IF NOT EXISTS "parent_job_id" UUID;

-- Add foreign key constraint
ALTER TABLE "fine_tune_job"
ADD CONSTRAINT "fine_tune_job_parent_job_id_fkey" 
FOREIGN KEY ("parent_job_id") 
REFERENCES "fine_tune_job"("job_id") 
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS "fine_tune_job_parent_job_id_idx" 
ON "fine_tune_job"("parent_job_id");

