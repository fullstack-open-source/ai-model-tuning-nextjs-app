-- Note: assigned_by_user_id field already exists in the original migration
-- This migration only ensures default groups exist

-- Insert default groups if they don't exist
-- This ensures the required groups (user, super_admin, admin, agent) are always available

-- Insert Super Admin group
INSERT INTO "groups" ("group_id", "name", "codename", "description", "is_system", "is_active", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  'Super Admin',
  'super_admin',
  'Full system access with all permissions',
  true,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "groups" WHERE "codename" = 'super_admin'
);

-- Insert Admin group
INSERT INTO "groups" ("group_id", "name", "codename", "description", "is_system", "is_active", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  'Sub Admin',
  'admin',
  'Administrative access with most permissions (no user deletion, limited system access)',
  true,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "groups" WHERE "codename" = 'admin'
);

-- Insert Agent group
INSERT INTO "groups" ("group_id", "name", "codename", "description", "is_system", "is_active", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  'Agent',
  'agent',
  'Support agent with user creation, profile management, notification management, and own activity access',
  true,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "groups" WHERE "codename" = 'agent'
);

-- Insert User group (most important - used for default signups)
INSERT INTO "groups" ("group_id", "name", "codename", "description", "is_system", "is_active", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  'User',
  'user',
  'Standard user with basic permissions',
  true,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "groups" WHERE "codename" = 'user'
);

