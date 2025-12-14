/**
 * Cache Invalidation Utilities
 * 
 * Handles cache invalidation when data changes (CREATE, UPDATE, DELETE operations).
 * Uses pattern matching to invalidate related cache keys efficiently.
 * Respects REDIS_CACHE_ENABLED flag - only invalidates if cache is enabled.
 */

import { cache } from './cache';
import { redisConfig } from '@lib/config/env';
import { logger } from '@lib/logger/logger';
import {
  getUserCacheKey,
  getUsersListCachePattern,
  getGroupsCacheKey,
  getGroupCacheKey,
  getPermissionsCacheKey,
  getPermissionCacheKey,
  getDashboardOverviewCacheKey,
  getNotificationsCachePattern,
  getActivityLogsCachePattern,
  getUserPermissionsCacheKey,
  getUserPermissionsCachePattern,
  getUserGroupsCacheKey,
} from './keys';

/**
 * Invalidate cache for a specific user
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    const userKey = getUserCacheKey(userId);
    await cache.delete(userKey);
    logger.debug('User cache invalidated', {
      module: 'Cache',
      label: 'CACHE_INVALIDATED',
      extraData: { key: userKey, userId }
    });
  } catch (error) {
    logger.warning('Failed to invalidate user cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { userId, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate all user list cache keys
 * This should be called when any user is created, updated, or deleted
 * to ensure pagination results stay updated
 */
export async function invalidateUsersListCache(): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    const pattern = getUsersListCachePattern();
    const deletedCount = await cache.deleteByPattern(pattern);
    logger.debug('Users list cache invalidated', {
      module: 'Cache',
      label: 'CACHE_PATTERN_INVALIDATED',
      extraData: { pattern, deletedCount }
    });
  } catch (error) {
    logger.warning('Failed to invalidate users list cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate user permissions cache
 * Call this when user's groups or permissions change
 */
export async function invalidateUserPermissionsCache(userId?: string): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    if (userId) {
      // Invalidate specific user's permissions cache
      const permCacheKey = getUserPermissionsCacheKey(userId);
      const groupsCacheKey = getUserGroupsCacheKey(userId);
      await Promise.all([
        cache.delete(permCacheKey),
        cache.delete(groupsCacheKey),
      ]);
      logger.debug('User permissions and groups cache invalidated', {
        module: 'Cache',
        label: 'CACHE_INVALIDATED',
        extraData: { permCacheKey, groupsCacheKey, userId }
      });
    } else {
      // Invalidate all user permissions and groups cache
      const permPattern = getUserPermissionsCachePattern();
      const groupsPattern = 'user:*:groups';
      const [permDeleted, groupsDeleted] = await Promise.all([
        cache.deleteByPattern(permPattern),
        cache.deleteByPattern(groupsPattern),
      ]);
      logger.debug('All user permissions and groups cache invalidated', {
        module: 'Cache',
        label: 'CACHE_PATTERN_INVALIDATED',
        extraData: { 
          permPattern, 
          groupsPattern, 
          permDeleted, 
          groupsDeleted 
        }
      });
    }
  } catch (error) {
    logger.warning('Failed to invalidate user permissions cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { userId, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate all cache related to a user (both individual and list caches)
 * This is the main function to call when a user is created, updated, or deleted
 */
export async function invalidateAllUserRelatedCache(userId?: string): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    // Invalidate specific user cache if userId provided
    if (userId) {
      await invalidateUserCache(userId);
      // Also invalidate user permissions cache
      await invalidateUserPermissionsCache(userId);
    }

    // Invalidate all users list caches
    await invalidateUsersListCache();
    
    // Also invalidate dashboard stats that depend on user counts
    await invalidateDashboardCache();
  } catch (error) {
    logger.warning('Failed to invalidate user-related cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { userId, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate groups cache
 */
export async function invalidateGroupsCache(groupId?: string): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    if (groupId) {
      await cache.delete(getGroupCacheKey(groupId));
    }
    await cache.delete(getGroupsCacheKey());
    logger.debug('Groups cache invalidated', {
      module: 'Cache',
      label: 'CACHE_INVALIDATED',
      extraData: { groupId }
    });
  } catch (error) {
    logger.warning('Failed to invalidate groups cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { groupId, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate permissions cache
 */
export async function invalidatePermissionsCache(permissionId?: string): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    if (permissionId) {
      await cache.delete(getPermissionCacheKey(permissionId));
    }
    await cache.delete(getPermissionsCacheKey());
    logger.debug('Permissions cache invalidated', {
      module: 'Cache',
      label: 'CACHE_INVALIDATED',
      extraData: { permissionId }
    });
  } catch (error) {
    logger.warning('Failed to invalidate permissions cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { permissionId, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate dashboard cache
 */
export async function invalidateDashboardCache(): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    await cache.delete(getDashboardOverviewCacheKey());
    const pattern = 'dashboard:*';
    await cache.deleteByPattern(pattern);
    logger.debug('Dashboard cache invalidated', {
      module: 'Cache',
      label: 'CACHE_INVALIDATED'
    });
  } catch (error) {
    logger.warning('Failed to invalidate dashboard cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate notifications cache
 */
export async function invalidateNotificationsCache(notificationId?: string): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    if (notificationId) {
      const { getNotificationCacheKey } = await import('./keys');
      await cache.delete(getNotificationCacheKey(notificationId));
    }
    const pattern = getNotificationsCachePattern();
    await cache.deleteByPattern(pattern);
    logger.debug('Notifications cache invalidated', {
      module: 'Cache',
      label: 'CACHE_INVALIDATED',
      extraData: { notificationId }
    });
  } catch (error) {
    logger.warning('Failed to invalidate notifications cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { notificationId, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Invalidate activity logs cache
 */
export async function invalidateActivityLogsCache(): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    const pattern = getActivityLogsCachePattern();
    await cache.deleteByPattern(pattern);
    const statsPattern = 'activity:statistics:*';
    await cache.deleteByPattern(statsPattern);
    logger.debug('Activity logs cache invalidated', {
      module: 'Cache',
      label: 'CACHE_INVALIDATED'
    });
  } catch (error) {
    logger.warning('Failed to invalidate activity logs cache', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * Enhanced invalidation using Redis pattern matching
 * Uses the cache's deleteByPattern method
 */
export async function invalidateByPattern(pattern: string): Promise<void> {
  if (!redisConfig.enabled) return;

  try {
    const deletedCount = await cache.deleteByPattern(pattern);
    logger.debug('Cache pattern invalidated', {
      module: 'Cache',
      label: 'CACHE_PATTERN_INVALIDATED',
      extraData: { pattern, deletedCount }
    });
  } catch (error) {
    logger.warning('Failed to invalidate cache pattern', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: { pattern, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

