-- ==============================================================================
-- PostgreSQL Initialization Script for Next.js Frontend
-- This script runs when the PostgreSQL container starts for the first time
-- ==============================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Set default timezone
SET timezone = 'UTC';

-- Grant privileges (if using custom user)
-- GRANT ALL PRIVILEGES ON DATABASE nextjs_db TO postgres;

-- Create custom types (if needed)
-- These can be created by Prisma, but adding here for reference

-- Create indexes for better performance (optional - Prisma will create these)
-- CREATE INDEX IF NOT EXISTS idx_users_email ON "User"(email);
-- CREATE INDEX IF NOT EXISTS idx_users_username ON "User"(user_name);

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL database initialized successfully at %', NOW();
END $$;

