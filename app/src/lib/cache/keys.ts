/**
 * Cache Key Generation Utilities
 * 
 * Centralized cache key generation to ensure consistency across the application.
 * All cache keys follow a pattern: `resource:identifier:params`
 */

/**
 * Generate cache key for a single user
 */
export function getUserCacheKey(userId: string): string {
  return `user:${userId}`;
}

/**
 * Generate cache key for users list with filters and pagination
 */
export function getUsersListCacheKey(params: {
  page?: number;
  limit?: number;
  search?: string;
  auth_type?: string;
  status?: string;
  gender?: string;
  is_active?: string | boolean;
  is_verified?: string | boolean;
}): string {
  const {
    page = 1,
    limit = 50,
    search = '',
    auth_type = '',
    status = '',
    gender = '',
    is_active = '',
    is_verified = '',
  } = params;

  // Normalize boolean values to strings for consistent key generation
  const normalizedIsActive = typeof is_active === 'boolean' ? String(is_active) : is_active;
  const normalizedIsVerified = typeof is_verified === 'boolean' ? String(is_verified) : is_verified;

  // Create a sorted, normalized key to ensure same filters produce same key
  const keyParts = [
    'users:list',
    `page:${page}`,
    `limit:${limit}`,
    search ? `search:${search.toLowerCase().trim()}` : '',
    auth_type ? `auth_type:${auth_type}` : '',
    status ? `status:${status}` : '',
    gender ? `gender:${gender}` : '',
    normalizedIsActive ? `is_active:${normalizedIsActive}` : '',
    normalizedIsVerified ? `is_verified:${normalizedIsVerified}` : '',
  ].filter(Boolean);

  return keyParts.join(':');
}

/**
 * Generate pattern for all user list cache keys
 * Used for invalidation when any user data changes
 */
export function getUsersListCachePattern(): string {
  return 'users:list:*';
}

/**
 * Generate pattern for all user-related cache keys
 * Used for comprehensive invalidation
 */
export function getUserCachePattern(userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  return 'user:*';
}

/**
 * Generate pattern for all cache keys related to users
 * This includes both individual user keys and list keys
 */
export function getAllUsersCachePattern(): string {
  return 'user:*';
}

/**
 * Generate cache key for notifications with filters
 */
export function getNotificationsCacheKey(params: {
  status?: string;
  notification_type?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}): string {
  const {
    status = 'all',
    notification_type = 'all',
    priority = 'all',
    limit = 50,
    offset = 0,
  } = params;

  const keyParts = [
    'notifications',
    `status:${status}`,
    `type:${notification_type}`,
    `priority:${priority}`,
    `limit:${limit}`,
    `offset:${offset}`,
  ];

  return keyParts.join(':');
}

/**
 * Generate pattern for all notification cache keys
 */
export function getNotificationsCachePattern(): string {
  return 'notifications:*';
}

/**
 * Generate cache key for activity logs with filters
 */
export function getActivityLogsCacheKey(params: {
  user_id?: string;
  level?: string;
  action?: string;
  module?: string;
  limit?: number;
  offset?: number;
}): string {
  const {
    user_id = '',
    level = '',
    action = '',
    module = '',
    limit = 100,
    offset = 0,
  } = params;

  const keyParts = [
    'activity:logs',
    user_id ? `user:${user_id}` : '',
    level ? `level:${level}` : '',
    action ? `action:${action}` : '',
    module ? `module:${module}` : '',
    `limit:${limit}`,
    `offset:${offset}`,
  ].filter(Boolean);

  return keyParts.join(':');
}

/**
 * Generate pattern for all activity log cache keys
 */
export function getActivityLogsCachePattern(): string {
  return 'activity:logs:*';
}

/**
 * Generate cache key for dashboard overview
 */
export function getDashboardOverviewCacheKey(): string {
  return 'dashboard:overview';
}

/**
 * Generate cache key for project information
 */
export function getProjectInformationCacheKey(): string {
  return 'project:information';
}

/**
 * Generate cache key for activity statistics   
 */
export function getActivityStatisticsCacheKey(params?: {
  user_id?: string;
  start_date?: string;
  end_date?: string;
}): string {
  const { user_id = '', start_date = '', end_date = '' } = params || {};
  const keyParts = [
    'activity:statistics',
    user_id ? `user:${user_id}` : '',
    start_date ? `start:${start_date}` : '',
    end_date ? `end:${end_date}` : '',
  ].filter(Boolean);
  return keyParts.join(':') || 'activity:statistics';
}

/**
 * Generate cache key for permissions list
 */
export function getPermissionsCacheKey(): string {
  return 'permissions:all';
}

/**
 * Generate cache key for groups list
 */
export function getGroupsCacheKey(): string {
  return 'groups:all';
}

/**
 * Generate cache key for a single group
 */
export function getGroupCacheKey(groupId: string): string {
  return `group:${groupId}`;
}

/**
 * Generate cache key for a single permission
 */
export function getPermissionCacheKey(permissionId: string): string {
  return `permission:${permissionId}`;
}

/**
 * Generate cache key for user groups
 */
export function getUserGroupsCacheKey(userId: string): string {
  return `user:${userId}:groups`;
}

/**
 * Generate cache key for user permissions
 * Format: user:{user_id}:permissions
 */
export function getUserPermissionsCacheKey(userId: string): string {
  return `user:${userId}:permissions`;
}

/**
 * Generate pattern for all user permission cache keys
 * Used for invalidation when user permissions change
 */
export function getUserPermissionsCachePattern(userId?: string): string {
  if (userId) {
    return `user:${userId}:permissions`;
  }
  return 'user:*:permissions';
}

/**
 * Generate cache key for user profile
 */
export function getUserProfileCacheKey(userId: string): string {
  return `profile:${userId}`;
}

/**
 * Generate cache key for notifications unread count
 */
export function getNotificationsUnreadCountCacheKey(): string {
  return 'notifications:unread-count';
}

/**
 * Generate cache key for a single notification
 */
export function getNotificationCacheKey(notificationId: string): string {
  return `notification:${notificationId}`;
}

/**
 * Generate cache key for dashboard statistics
 */
export function getDashboardStatisticsCacheKey(type: string): string {
  return `dashboard:${type}`;
}

/**
 * Generate cache key for system analytics
 */
export function getSystemAnalyticsCacheKey(type: string, params?: Record<string, string | number>): string {
  const keyParts = ['system-analytics', type];
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      keyParts.push(`${key}:${value}`);
    });
  }
  return keyParts.join(':');
}

/**
 * Generate cache key for activity logs by user
 */
export function getUserActivityLogsCacheKey(userId: string, filters?: Record<string, unknown>): string {
  const keyParts = ['activity:logs', `user:${userId}`];
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        keyParts.push(`${key}:${String(value)}`);
      }
    });
  }
  return keyParts.join(':');
}

/**
 * Generate cache key for group permissions
 */
export function getGroupPermissionsCacheKey(groupId: string): string {
  return `group:${groupId}:permissions`;
}


