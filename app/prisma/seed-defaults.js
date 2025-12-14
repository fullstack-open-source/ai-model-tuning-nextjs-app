// Load environment variables from .env file
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Simple logger for seed script
const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message, data) => console.error(`[ERROR] ${message}`, data || ''),
  debug: (message, data) => console.debug(`[DEBUG] ${message}`, data || ''),
};

// Check DATABASE_URL
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is not set');
  logger.error('Please ensure .env file exists with DATABASE_URL');
  process.exit(1);
}

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with adapter (required for Prisma 7)
const prisma = new PrismaClient({
  adapter: adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

const defaultPermissions = [
  // ============================================
  // AUTH MODULE - Authentication & Authorization
  // ============================================
  {
    name: 'View Auth Info',
    codename: 'view_auth',
    description: 'Can view authentication information (token info, session)',
    category: 'auth'
  },
  {
    name: 'Manage Auth',
    codename: 'manage_auth',
    description: 'Can manage authentication (change password, verify, etc.)',
    category: 'auth'
  },
  
  // ============================================
  // DASHBOARD MODULE - Dashboard & Statistics
  // ============================================
  {
    name: 'View Dashboard',
    codename: 'view_dashboard',
    description: 'Can view dashboard and overview statistics',
    category: 'dashboard'
  },
  {
    name: 'View Dashboard Statistics',
    codename: 'view_dashboard_statistics',
    description: 'Can view detailed dashboard statistics (user growth, role stats, etc.)',
    category: 'dashboard'
  },
  {
    name: 'Manage Dashboard',
    codename: 'manage_dashboard',
    description: 'Can manage dashboard settings and view all statistics',
    category: 'dashboard'
  },
  
  // ============================================
  // USER MODULE - User Management
  // ============================================
  {
    name: 'View User',
    codename: 'view_user',
    description: 'Can view individual user profiles and information',
    category: 'user'
  },
  {
    name: 'View Users',
    codename: 'view_users',
    description: 'Can view list of all users',
    category: 'user'
  },
  {
    name: 'Add User',
    codename: 'add_user',
    description: 'Can create new users',
    category: 'user'
  },
  {
    name: 'Edit User',
    codename: 'edit_user',
    description: 'Can edit user profiles and information',
    category: 'user'
  },
  {
    name: 'Delete User',
    codename: 'delete_user',
    description: 'Can delete users',
    category: 'user'
  },
  {
    name: 'Suspend User',
    codename: 'suspend_user',
    description: 'Can suspend/block users',
    category: 'user'
  },
  {
    name: 'Activate User',
    codename: 'activate_user',
    description: 'Can activate suspended users',
    category: 'user'
  },
  {
    name: 'Reset User Password',
    codename: 'reset_user_password',
    description: 'Can reset password for users',
    category: 'user'
  },
  {
    name: 'Force Logout User',
    codename: 'force_logout',
    description: 'Can force user to logout',
    category: 'user'
  },
  {
    name: 'Manage Users',
    codename: 'manage_users',
    description: 'Can fully manage users (create, edit, delete, suspend, activate)',
    category: 'user'
  },
  {
    name: 'View User Groups',
    codename: 'view_user_groups',
    description: 'Can view groups assigned to users',
    category: 'user'
  },
  {
    name: 'Assign User Groups',
    codename: 'assign_user_groups',
    description: 'Can assign groups to users',
    category: 'user'
  },
  {
    name: 'View User Permissions',
    codename: 'view_user_permissions',
    description: 'Can view permissions assigned to users',
    category: 'user'
  },
  
  // ============================================
  // PROFILE MODULE - Profile & Settings
  // ============================================
  {
    name: 'View Profile',
    codename: 'view_profile',
    description: 'Can view own profile',
    category: 'profile'
  },
  {
    name: 'Edit Profile',
    codename: 'edit_profile',
    description: 'Can edit own profile information',
    category: 'profile'
  },
  {
    name: 'Update Profile Picture',
    codename: 'update_profile_picture',
    description: 'Can update own profile picture',
    category: 'profile'
  },
  {
    name: 'Change Email',
    codename: 'change_email',
    description: 'Can change own email address',
    category: 'profile'
  },
  {
    name: 'Change Phone',
    codename: 'change_phone',
    description: 'Can change own phone number',
    category: 'profile'
  },
  {
    name: 'Update Theme',
    codename: 'update_theme',
    description: 'Can update own theme preferences',
    category: 'profile'
  },
  {
    name: 'Update Language',
    codename: 'update_language',
    description: 'Can update own language preferences',
    category: 'profile'
  },
  {
    name: 'Update Timezone',
    codename: 'update_timezone',
    description: 'Can update own timezone preferences',
    category: 'profile'
  },
  {
    name: 'Update Profile Accessibility',
    codename: 'update_profile_accessibility',
    description: 'Can update own profile accessibility settings',
    category: 'profile'
  },
  {
    name: 'Deactivate Account',
    codename: 'deactivate_account',
    description: 'Can deactivate own account',
    category: 'profile'
  },
  {
    name: 'Delete Account',
    codename: 'delete_account',
    description: 'Can delete own account',
    category: 'profile'
  },
  {
    name: 'Manage Profile',
    codename: 'manage_profile',
    description: 'Can fully manage own profile and settings',
    category: 'profile'
  },
  
  // ============================================
  // GROUP MODULE - Group Management
  // ============================================
  {
    name: 'View Groups',
    codename: 'view_group',
    description: 'Can view groups',
    category: 'group'
  },
  {
    name: 'View Group Statistics',
    codename: 'view_group_statistics',
    description: 'Can view group statistics and analytics',
    category: 'group'
  },
  {
    name: 'Add Group',
    codename: 'add_group',
    description: 'Can create new groups',
    category: 'group'
  },
  {
    name: 'Edit Group',
    codename: 'edit_group',
    description: 'Can edit group information',
    category: 'group'
  },
  {
    name: 'Delete Group',
    codename: 'delete_group',
    description: 'Can delete groups',
    category: 'group'
  },
  {
    name: 'View Group Permissions',
    codename: 'view_group_permissions',
    description: 'Can view permissions assigned to groups',
    category: 'group'
  },
  {
    name: 'Assign Group Permissions',
    codename: 'assign_group_permissions',
    description: 'Can assign permissions to groups',
    category: 'group'
  },
  {
    name: 'Manage Groups',
    codename: 'manage_groups',
    description: 'Can fully manage groups (create, edit, delete, assign permissions)',
    category: 'group'
  },
  
  // ============================================
  // PERMISSION MODULE - Permission Management
  // ============================================
  {
    name: 'View Permissions',
    codename: 'view_permission',
    description: 'Can view permissions',
    category: 'permission'
  },
  {
    name: 'View Permission Statistics',
    codename: 'view_permission_statistics',
    description: 'Can view permission statistics and analytics',
    category: 'permission'
  },
  {
    name: 'Add Permission',
    codename: 'add_permission',
    description: 'Can create new permissions',
    category: 'permission'
  },
  {
    name: 'Edit Permission',
    codename: 'edit_permission',
    description: 'Can edit permissions',
    category: 'permission'
  },
  {
    name: 'Delete Permission',
    codename: 'delete_permission',
    description: 'Can delete permissions',
    category: 'permission'
  },
  {
    name: 'Manage Permissions',
    codename: 'manage_permissions',
    description: 'Can fully manage permissions (create, edit, delete)',
    category: 'permission'
  },
  
  // ============================================
  // NOTIFICATION MODULE - Notifications
  // ============================================
  {
    name: 'View Notifications',
    codename: 'view_notification',
    description: 'Can view notifications',
    category: 'notification'
  },
  {
    name: 'View Notification Count',
    codename: 'view_notification_count',
    description: 'Can view unread notification count',
    category: 'notification'
  },
  {
    name: 'Add Notification',
    codename: 'add_notification',
    description: 'Can create new notifications',
    category: 'notification'
  },
  {
    name: 'Edit Notification',
    codename: 'edit_notification',
    description: 'Can edit notifications',
    category: 'notification'
  },
  {
    name: 'Delete Notification',
    codename: 'delete_notification',
    description: 'Can delete notifications',
    category: 'notification'
  },
  {
    name: 'Mark Notification Read',
    codename: 'mark_notification_read',
    description: 'Can mark notifications as read',
    category: 'notification'
  },
  {
    name: 'Manage Notifications',
    codename: 'manage_notifications',
    description: 'Can fully manage notifications (create, edit, delete, mark read)',
    category: 'notification'
  },
  
  // ============================================
  // ACTIVITY MODULE - Activity Logs
  // ============================================
  {
    name: 'View Activity Logs',
    codename: 'view_activity_log',
    description: 'Can view activity logs',
    category: 'activity'
  },
  {
    name: 'View Own Activity Logs',
    codename: 'view_own_activity_log',
    description: 'Can view own activity logs',
    category: 'activity'
  },
  {
    name: 'View User Activity Logs',
    codename: 'view_user_activity_log',
    description: 'Can view activity logs for specific users',
    category: 'activity'
  },
  {
    name: 'View Activity Statistics',
    codename: 'view_activity_statistics',
    description: 'Can view activity log statistics and analytics',
    category: 'activity'
  },
  {
    name: 'Delete Activity Logs',
    codename: 'delete_activity_log',
    description: 'Can delete activity logs',
    category: 'activity'
  },
  {
    name: 'Cleanup Activity Logs',
    codename: 'cleanup_activity_log',
    description: 'Can cleanup old activity logs',
    category: 'activity'
  },
  {
    name: 'Manage Activity Logs',
    codename: 'manage_activity_log',
    description: 'Can fully manage activity logs (view, delete, cleanup)',
    category: 'activity'
  },
  {
    name: 'Manage Activity Logs (Plural)',
    codename: 'manage_activity_logs',
    description: 'Can fully manage activity logs - alternative permission name used in API routes',
    category: 'activity'
  },
  
  // ============================================
  // PROJECT MODULE - Project Settings
  // ============================================
  {
    name: 'View Project Settings',
    codename: 'view_project_settings',
    description: 'Can view project information and settings',
    category: 'project'
  },
  {
    name: 'Edit Project Settings',
    codename: 'edit_project_settings',
    description: 'Can edit project information and settings',
    category: 'project'
  },
  {
    name: 'Manage Project Settings',
    codename: 'manage_project_settings',
    description: 'Can fully manage project settings including logos and meta data',
    category: 'project'
  },
  
  // ============================================
  // SYSTEM ANALYTICS MODULE - System Analytics
  // ============================================
  {
    name: 'View System Analytics',
    codename: 'view_system_analytics',
    description: 'Can view system analytics and monitoring',
    category: 'system_analytics'
  },
  {
    name: 'View System Info',
    codename: 'view_system_info',
    description: 'Can view system information (CPU, memory, disk, etc.)',
    category: 'system_analytics'
  },
  {
    name: 'View System Errors',
    codename: 'view_system_errors',
    description: 'Can view system errors and logs',
    category: 'system_analytics'
  },
  {
    name: 'View System Logs',
    codename: 'view_system_logs',
    description: 'Can view system log files and statistics',
    category: 'system_analytics'
  },
  {
    name: 'View Docker Status',
    codename: 'view_docker_status',
    description: 'Can view Docker container status',
    category: 'system_analytics'
  },
  {
    name: 'View System Processes',
    codename: 'view_system_processes',
    description: 'Can view system processes and top processes',
    category: 'system_analytics'
  },
  {
    name: 'View Cache Statistics',
    codename: 'view_cache_statistics',
    description: 'Can view cache (Redis) statistics and keys',
    category: 'system_analytics'
  },
  {
    name: 'Manage Cache',
    codename: 'manage_cache',
    description: 'Can manage cache (view, delete keys)',
    category: 'system_analytics'
  },
  {
    name: 'Manage System Logs',
    codename: 'manage_system_logs',
    description: 'Can manage system logs (view, clear, delete)',
    category: 'system_analytics'
  },
  {
    name: 'Manage System Analytics',
    codename: 'manage_system_analytics',
    description: 'Can fully manage system analytics and monitoring',
    category: 'system_analytics'
  },
  
  // ============================================
  // MEDIA MODULE - Media/Uploads
  // ============================================
  {
    name: 'View Media',
    codename: 'view_media',
    description: 'Can view media files',
    category: 'media'
  },
  {
    name: 'Add Upload',
    codename: 'add_upload',
    description: 'Can upload media files',
    category: 'media'
  },
  {
    name: 'Delete Upload',
    codename: 'delete_upload',
    description: 'Can delete media files',
    category: 'media'
  },
  {
    name: 'Manage Media',
    codename: 'manage_media',
    description: 'Can fully manage media files (upload, delete)',
    category: 'media'
  },
  
  // ============================================
  // ACCOUNT SHARING MODULE - Share Account Access
  // ============================================
  {
    name: 'View Account Sharing',
    codename: 'view_account_sharing',
    description: 'Can view account sharing settings and invitations',
    category: 'account_sharing'
  },
  {
    name: 'Share Account Access',
    codename: 'share_account',
    description: 'Can share own account access with other users',
    category: 'account_sharing'
  },
  {
    name: 'Request Account Access',
    codename: 'request_account_access',
    description: 'Can request access to other users accounts',
    category: 'account_sharing'
  },
  {
    name: 'Accept Account Share',
    codename: 'accept_account_share',
    description: 'Can accept account sharing invitations',
    category: 'account_sharing'
  },
  {
    name: 'Revoke Account Share',
    codename: 'revoke_account_share',
    description: 'Can revoke shared account access',
    category: 'account_sharing'
  },
  {
    name: 'View Account Share Activity',
    codename: 'view_share_activity',
    description: 'Can view account sharing activity logs',
    category: 'account_sharing'
  },
  {
    name: 'Manage Account Sharing',
    codename: 'manage_account_sharing',
    description: 'Can fully manage account sharing (share, revoke, view activity)',
    category: 'account_sharing'
  },
  {
    name: 'Admin Manage All Shares',
    codename: 'admin_manage_shares',
    description: 'Admin permission to view and manage all account shares',
    category: 'account_sharing'
  },
  
];

// ============================================
// DEFAULT PROJECT SETTINGS
// ============================================
const defaultProjectSettings = {
  project_id: 'default',
  name: process.env.PROJECT_NAME || 'Nextjs Starter',
  title: process.env.PROJECT_TITLE || process.env.PROJECT_NAME || 'Nextjs Starter',
  base_url: process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000',
  support_email: process.env.SUPPORT_EMAIL || 'support@example.com',
  support_contact: process.env.SUPPORT_CONTACT || '+1234567890',
  company_address: process.env.COMPANY_ADDRESS || '123 Main Street, City, Country',
  
  // Logos - set to null, can be updated via admin panel
  logo: null,
  hlogo: null,
  flogo: null,
  
  // Social Media Links - set to null by default
  facebook: null,
  twitter: null,
  instagram: null,
  linkedin: null,
  youtube: null,
  tiktok: null,
  whatsapp: null,
  vimeo: null,
  pinterest: null,
  
  // SEO & Meta
  meta_title: process.env.PROJECT_NAME || 'Full Stack Application',
  meta_description: process.env.PROJECT_DESCRIPTION || 'A modern full-stack web application',
  meta_keywords: 'web app, dashboard, admin panel',
  head_meta_data: null,
  body_meta_data: null,
  extra_meta_data: null,
};

const defaultGroups = [
  {
    name: 'Super Admin',
    codename: 'super_admin',
    description: 'Full system access with all permissions',
    is_system: true,
    is_active: true,
    permissions: [
      // Auth
      'view_auth', 'manage_auth',
  
      // Dashboard
      'view_dashboard', 'view_dashboard_statistics', 'manage_dashboard',
  
      // Profile
      'view_profile', 'edit_profile', 'update_profile_picture', 'change_email', 'change_phone',
      'update_theme', 'update_language', 'update_timezone', 'update_profile_accessibility',
      'deactivate_account', 'delete_account', 'manage_profile',
  
      // User Management
      'view_user', 'view_users', 'add_user', 'edit_user', 'delete_user', 'suspend_user',
      'activate_user', 'reset_user_password', 'force_logout', 'manage_users',
      'view_user_groups', 'assign_user_groups', 'view_user_permissions',
  
      // Permissions
      'view_permission', 'view_permission_statistics', 'add_permission', 'edit_permission',
      'delete_permission', 'manage_permissions',
  
      // Groups
      'view_group', 'view_group_statistics', 'add_group', 'edit_group', 'delete_group',
      'view_group_permissions', 'assign_group_permissions', 'manage_groups',
  
      // Notifications
      'view_notification', 'view_notification_count', 'add_notification', 'edit_notification',
      'delete_notification', 'mark_notification_read', 'manage_notifications',
  
      // Activity Logs
      'view_activity_log', 'view_own_activity_log', 'view_user_activity_log',
      'view_activity_statistics', 'delete_activity_log', 'cleanup_activity_log', 'manage_activity_log', 'manage_activity_logs',
  
      // Project Settings
      'view_project_settings', 'edit_project_settings', 'manage_project_settings',
  
      // System Analytics
      'view_system_analytics', 'view_system_info', 'view_system_errors', 'view_system_logs',
      'view_docker_status', 'view_system_processes', 'view_cache_statistics',
      'manage_cache', 'manage_system_logs', 'manage_system_analytics',
  
      // Media
      'view_media', 'add_upload', 'delete_upload', 'manage_media',

      // Account Sharing
      'view_account_sharing', 'share_account', 'request_account_access',
      'accept_account_share', 'revoke_account_share', 'view_share_activity',
      'manage_account_sharing', 'admin_manage_shares'
    ]
  },
  {
    name: 'Sub Admin',
    codename: 'admin',
    description: 'Administrative access with most permissions (no user deletion, limited system access)',
    is_system: true,
    is_active: true,
    permissions: [
      // Auth
      'view_auth',
    
      // Dashboard
      'view_dashboard', 'view_dashboard_statistics', 'manage_dashboard',
    
      // Profile
      'view_profile', 'edit_profile', 'update_profile_picture',
      'change_email', 'change_phone',
      'update_theme', 'update_language', 'update_timezone',
      'update_profile_accessibility', 'deactivate_account',
      'delete_account', 'manage_profile',
    
      // Users (No deletion)
      'view_user', 'view_users', 'add_user', 'edit_user',
      'suspend_user', 'activate_user', 'reset_user_password',
      'view_user_groups', 'assign_user_groups', 'view_user_permissions',
    
      // Permissions (View only)
      'view_permission', 'view_permission_statistics',
    
      // Groups (No deletion)
      'view_group', 'view_group_statistics', 'add_group', 'edit_group',
      'view_group_permissions', 'assign_group_permissions',
    
      // Notifications (Full)
      'view_notification', 'view_notification_count', 'add_notification',
      'edit_notification', 'delete_notification', 'mark_notification_read',
      'manage_notifications',
    
      // Activity (View only)
      'view_activity_log', 'view_own_activity_log', 'view_user_activity_log', 'view_activity_statistics',
    
      // Project Settings
      'view_project_settings', 'edit_project_settings',
    
      // System Analytics (View only)
      'view_system_analytics', 'view_system_info', 'view_system_errors',
      'view_system_logs', 'view_docker_status', 'view_system_processes',
      'view_cache_statistics',
    
      // Media (Full)
      'view_media', 'add_upload', 'delete_upload', 'manage_media',

      // Account Sharing
      'view_account_sharing', 'share_account', 'request_account_access',
      'accept_account_share', 'revoke_account_share', 'view_share_activity',
      'manage_account_sharing'
    ]
  },
  {
    name: 'Agent',
    codename: 'agent',
    description: 'Support agent with user creation, profile management, notification management, and own activity access',
    is_system: true,
    is_active: true,
    permissions: [
      // Profile
      'view_profile', 'edit_profile', 'update_profile_picture',
      'change_email', 'change_phone',
      'update_theme', 'update_language', 'update_timezone',
      'update_profile_accessibility', 'deactivate_account',
      'delete_account', 'manage_profile',
    
      // Dashboard
      'view_dashboard',
  
      // Activity
      'view_own_activity_log',
    
      // Notifications
      'view_notification', 'view_notification_count', 'add_notification',
      'edit_notification', 'delete_notification', 'mark_notification_read',
      'manage_notifications',

      // Account Sharing
      'view_account_sharing', 'share_account', 'request_account_access',
      'accept_account_share', 'revoke_account_share', 'view_share_activity',
      'manage_account_sharing'
    ]
  },
  {
    name: 'User',
    codename: 'user',
    description: 'Standard user with basic permissions',
    is_system: true,
    is_active: true,
    permissions: [
      // Profile
      'view_profile', 'edit_profile', 'update_profile_picture',
      'change_email', 'change_phone',
      'update_theme', 'update_language', 'update_timezone',
      'update_profile_accessibility', 'deactivate_account',
      'delete_account', 'manage_profile',
    
      // Dashboard
      'view_dashboard',
  
      // Activity
      'view_own_activity_log',
    
      // Notifications
      'view_notification', 'view_notification_count',
      'delete_notification', 'mark_notification_read',
      'manage_notifications',
    
      // Media
      'view_media', 'add_upload',

      // Account Sharing
      'view_account_sharing', 'share_account', 'request_account_access',
      'accept_account_share', 'revoke_account_share', 'view_share_activity',
      'manage_account_sharing'
    ]
  },
];

async function seedPermissions() {
  logger.info('Seeding permissions...');
  
  const createdPermissions = {};
  let createdCount = 0;
  let skippedCount = 0;
  
  for (const permData of defaultPermissions) {
    try {
      let permission = await prisma.permission.findUnique({
        where: { codename: permData.codename }
      });
      
      if (permission) {
        logger.info(`Permission already exists, skipping: ${permData.codename}`);
        skippedCount++;
      } else {
        permission = await prisma.permission.create({
          data: permData
        });
        logger.info(`Permission created: ${permData.codename}`);
        createdCount++;
      }
      
      createdPermissions[permData.codename] = permission;
    } catch (error) {
      logger.error(`Failed to create permission ${permData.codename}`, { error: error.message });
      throw error;
    }
  }
  
  logger.info(`Successfully processed permissions: ${createdCount} created, ${skippedCount} skipped`);
  return createdPermissions;
}

async function seedGroups(permissions) {
  logger.info('Seeding groups...');
  
  const createdGroups = {};
  let createdCount = 0;
  let skippedCount = 0;
  
  for (const groupData of defaultGroups) {
    try {
      const { permissions: permCodenames, ...groupInfo } = groupData;
      
      let group = await prisma.group.findUnique({
        where: { codename: groupData.codename }
      });
      
      if (group) {
        logger.info(`Group already exists, skipping: ${groupData.codename}`);
        skippedCount++;
      } else {
        group = await prisma.group.create({
          data: groupInfo
        });
        logger.info(`Group created: ${groupData.codename}`);
        createdCount++;
      }
      
      createdGroups[groupData.codename] = group;
      
      // Always check and assign permissions (this function already skips existing relationships)
      if (permCodenames && permCodenames.length > 0) {
        await assignPermissionsToGroup(group.group_id, permCodenames, permissions);
        logger.info(`Processed ${permCodenames.length} permissions for group ${groupData.codename}`);
      }
    } catch (error) {
      logger.error(`Failed to create group ${groupData.codename}`, { error: error.message });
      throw error;
    }
  }
  
  logger.info(`Successfully processed groups: ${createdCount} created, ${skippedCount} skipped`);
  return createdGroups;
}

async function assignPermissionsToGroup(groupId, permissionCodenames, permissionsMap) {
  let createdCount = 0;
  let skippedCount = 0;
  
  for (const codename of permissionCodenames) {
    const permission = permissionsMap[codename];
    if (!permission) {
      logger.warn(`Permission ${codename} not found, skipping assignment`);
      continue;
    }
    
    try {
      const existing = await prisma.groupPermission.findUnique({
        where: {
          group_id_permission_id: {
            group_id: groupId,
            permission_id: permission.permission_id
          }
        }
      });
      
      if (!existing) {
        await prisma.groupPermission.create({
          data: {
            group_id: groupId,
            permission_id: permission.permission_id
          }
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      logger.error(`Failed to assign permission ${codename} to group`, { error: error.message });
    }
  }
  
  if (createdCount > 0 || skippedCount > 0) {
    logger.debug(`Group permissions: ${createdCount} created, ${skippedCount} already existed`);
  }
}

async function assignDefaultGroupsToUsers(groups) {
  logger.info('Assigning default groups to existing users...');
  
  try {
    const users = await prisma.user.findMany({
      where: {
        is_active: true
      },
      select: {
        user_id: true,
        email: true
      }
    });
    
    logger.info(`Found ${users.length} users to process`);
    
    const defaultGroup = groups['user'];
    if (!defaultGroup) {
      logger.warn('Default "user" group not found, skipping user group assignment');
      return { totalUsers: users.length, assignedCount: 0 };
    }
    
    let assignedCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      try {
        const existing = await prisma.userGroup.findUnique({
          where: {
            user_id_group_id: {
              user_id: user.user_id,
              group_id: defaultGroup.group_id
            }
          }
        });
        
        if (!existing) {
          await prisma.userGroup.create({
            data: {
              user_id: user.user_id,
              group_id: defaultGroup.group_id
            }
          });
          assignedCount++;
          logger.info(`Assigned default "user" group to user ${user.email || user.user_id}`);
        } else {
          skippedCount++;
        }
      } catch (error) {
        logger.error(`Failed to assign group to user ${user.email || user.user_id}`, { error: error.message });
      }
    }
    
    logger.info(`Group assignment completed: ${assignedCount} assignments made, ${skippedCount} users already had groups`);
    return { totalUsers: users.length, assignedCount, skippedCount };
  } catch (error) {
    logger.error('Failed to assign default groups to users', { error: error.message });
    throw error;
  }
}

async function seedProjectSettings() {
  logger.info('Seeding project settings...');
  
  try {
    // Check if ANY project settings exist (we only want one record)
    let projectSettings = await prisma.projectSettings.findFirst({
      orderBy: { id: 'asc' }
    });
    
    if (projectSettings) {
      logger.info(`Project settings already exist (id: ${projectSettings.id}, project_id: ${projectSettings.project_id})`);
      
      // Update only if some key fields are empty or missing
      const needsUpdate = !projectSettings.name || !projectSettings.title || 
                          projectSettings.name === '' || projectSettings.title === '';
      
      if (needsUpdate) {
        projectSettings = await prisma.projectSettings.update({
          where: { id: projectSettings.id },
          data: {
            name: (projectSettings.name && projectSettings.name !== '') ? projectSettings.name : defaultProjectSettings.name,
            title: (projectSettings.title && projectSettings.title !== '') ? projectSettings.title : defaultProjectSettings.title,
            base_url: (projectSettings.base_url && projectSettings.base_url !== '') ? projectSettings.base_url : defaultProjectSettings.base_url,
            support_email: (projectSettings.support_email && projectSettings.support_email !== '') ? projectSettings.support_email : defaultProjectSettings.support_email,
            meta_title: (projectSettings.meta_title && projectSettings.meta_title !== '') ? projectSettings.meta_title : defaultProjectSettings.meta_title,
            meta_description: (projectSettings.meta_description && projectSettings.meta_description !== '') ? projectSettings.meta_description : defaultProjectSettings.meta_description,
          }
        });
        logger.info('Project settings updated with missing fields');
      } else {
        logger.info('Project settings already complete, skipping update');
      }
      
      // Clean up any duplicate project settings (keep only the first one)
      const allProjects = await prisma.projectSettings.findMany({ orderBy: { id: 'asc' } });
      if (allProjects.length > 1) {
        logger.warn(`Found ${allProjects.length} project settings, removing duplicates...`);
        for (let i = 1; i < allProjects.length; i++) {
          await prisma.projectSettings.delete({ where: { id: allProjects[i].id } });
          logger.info(`Deleted duplicate project settings (id: ${allProjects[i].id})`);
        }
      }
    } else {
      // Create new project settings
      projectSettings = await prisma.projectSettings.create({
        data: defaultProjectSettings
      });
      logger.info('Project settings created successfully');
    }
    
    return projectSettings;
  } catch (error) {
    logger.error('Failed to seed project settings', { error: error.message });
    throw error;
  }
}

async function seed() {
  try {
    logger.info('Starting database seeding...');
    logger.info('Note: Existing records will be skipped, only new records will be created');
    
    // Seed project settings first (single record)
    const projectSettings = await seedProjectSettings();
    
    const permissions = await seedPermissions();
    const groups = await seedGroups(permissions);
    
    const userAssignment = await assignDefaultGroupsToUsers(groups);
    
    logger.info('Database seeding completed successfully');
    logger.info(`Project settings: ${projectSettings ? 'created/updated' : 'skipped'}`);
    logger.info(`Total permissions processed: ${Object.keys(permissions).length}`);
    logger.info(`Total groups processed: ${Object.keys(groups).length}`);
    logger.info(`User-group assignments: ${userAssignment.assignedCount} new, ${userAssignment.skippedCount || 0} already existed`);
    
    return {
      projectSettings: projectSettings ? 1 : 0,
      permissions: Object.keys(permissions).length,
      groups: Object.keys(groups).length,
      userAssignments: userAssignment.assignedCount,
      usersProcessed: userAssignment.totalUsers,
      skippedUserAssignments: userAssignment.skippedCount || 0
    };
  } catch (error) {
    logger.error('Database seeding failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function main() {
  try {
    await seed();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Seed script failed', { error: error.message });
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seed, seedPermissions, seedGroups, seedProjectSettings, assignDefaultGroupsToUsers };

