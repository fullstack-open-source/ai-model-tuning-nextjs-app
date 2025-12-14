/**
 * Permission Service
 * 
 * Provides permission resolution functionality for users.
 * Resolves permissions through: User → UserGroup → Group → GroupPermission → Permission
 * Uses Redis caching for improved performance.
 */

import { prisma } from '@lib/db/prisma';
import { logger } from '@lib/logger/logger';
import { cache } from '@lib/cache/cache';
import { getUserPermissionsCacheKey } from '@lib/cache/keys';
import { CacheTTL } from '@lib/cache/cache';

export class PermissionService {
  /**
   * Get all permission codenames assigned to a user through their groups
   * Uses Redis cache for improved performance (key: user:{user_id}:permissions)
   * 
   * @param userId - The user ID to get permissions for
   * @param forceRefresh - If true, bypass cache and fetch from database
   * @returns Array of unique permission codenames (strings)
   * 
   * @example
   * const permissions = await permissionService.getUserPermissions('user-123');
   * // Returns: ['view_users', 'edit_users', 'delete_users', ...]
   */
  async getUserPermissions(userId: string, forceRefresh: boolean = false): Promise<string[]> {
    try {
      const cacheKey = getUserPermissionsCacheKey(userId);

      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedPermissions = await cache.get<string[]>(cacheKey);
        if (cachedPermissions !== null && Array.isArray(cachedPermissions)) {
          logger.debug('User permissions retrieved from cache', {
            module: 'PermissionService',
            extraData: {
              userId,
              permissionCount: cachedPermissions.length,
              fromCache: true,
            },
          });
          return cachedPermissions;
        }
      }

      // Cache miss or force refresh - fetch from database
      const userGroups = await prisma.userGroup.findMany({
        where: {
          user_id: userId,
          group: {
            is_active: true,
          },
        },
        include: {
          group: {
            include: {
              permissions: {
                include: {
                  permission: {
                    select: {
                      codename: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Extract all permission codenames from all groups
      const permissionSet = new Set<string>();

      for (const userGroup of userGroups) {
        // Skip if group is not active (double-check)
        if (!userGroup.group || !userGroup.group.is_active) {
          continue;
        }

        // Extract permission codenames from this group
        for (const groupPermission of userGroup.group.permissions) {
          if (groupPermission.permission?.codename) {
            permissionSet.add(groupPermission.permission.codename);
          }
        }
      }

      // Convert Set to sorted array for consistent output
      const permissions = Array.from(permissionSet).sort();

      // Cache the permissions for future requests (cache for 1 hour)
      await cache.set(cacheKey, permissions, CacheTTL.long);

      logger.debug('User permissions retrieved from database and cached', {
        module: 'PermissionService',
        extraData: {
          userId,
          permissionCount: permissions.length,
          fromCache: false,
        },
      });

      return permissions;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting user permissions', {
        module: 'PermissionService',
        extraData: {
          error: errorMessage,
          userId,
        },
      });
      return [];
    }
  }

  /**
   * Check if a user has a specific permission
   * Uses cached permissions for better performance
   * 
   * @param userId - The user ID to check
   * @param permission - The permission codename to check for
   * @returns True if user has the permission, false otherwise
   * 
   * @example
   * const canEdit = await permissionService.hasPermission('user-123', 'edit_users');
   * if (canEdit) {
   *   // User can edit users
   * }
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      // First try to get from cache
      const cacheKey = getUserPermissionsCacheKey(userId);
      const cachedPermissions = await cache.get<string[]>(cacheKey);
      
      if (cachedPermissions !== null && Array.isArray(cachedPermissions)) {
        // Use cached permissions
        return cachedPermissions.includes(permission);
      }

      // Cache miss - use optimized database query
      const count = await prisma.userGroup.count({
        where: {
          user_id: userId,
          group: {
            is_active: true,
            permissions: {
              some: {
                permission: {
                  codename: permission,
                },
              },
            },
          },
        },
      });

      return count > 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking user permission', {
        module: 'PermissionService',
        extraData: {
          error: errorMessage,
          userId,
          permission,
        },
      });
      return false;
    }
  }

  /**
   * Check if a user has any of the specified permissions
   * 
   * @param userId - The user ID to check
   * @param permissions - Array of permission codenames to check
   * @returns True if user has at least one of the permissions
   * 
   * @example
   * const canManage = await permissionService.hasAnyPermission('user-123', [
   *   'manage_users',
   *   'edit_users',
   *   'delete_users'
   * ]);
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    try {
      if (!permissions || permissions.length === 0) {
        return false;
      }

      // Check if user has any of the specified permissions
      const count = await prisma.userGroup.count({
        where: {
          user_id: userId,
          group: {
            is_active: true,
            permissions: {
              some: {
                permission: {
                  codename: {
                    in: permissions,
                  },
                },
              },
            },
          },
        },
      });

      return count > 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking user permissions', {
        module: 'PermissionService',
        extraData: {
          error: errorMessage,
          userId,
          permissions,
        },
      });
      return false;
    }
  }

  /**
   * Check if a user has all of the specified permissions
   * Uses cached permissions for better performance
   * 
   * @param userId - The user ID to check
   * @param permissions - Array of permission codenames to check
   * @returns True if user has all of the permissions
   * 
   * @example
   * const canFullManage = await permissionService.hasAllPermissions('user-123', [
   *   'view_users',
   *   'edit_users',
   *   'delete_users'
   * ]);
   */
  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    try {
      if (!permissions || permissions.length === 0) {
        return true; // Empty array means no requirements, so it passes
      }

      // Get user's permissions (uses cache)
      const userPermissions = await this.getUserPermissions(userId);
      const userPermissionSet = new Set(userPermissions);

      // Check if user has all required permissions
      return permissions.every((permission) => userPermissionSet.has(permission));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking user permissions', {
        module: 'PermissionService',
        extraData: {
          error: errorMessage,
          userId,
          permissions,
        },
      });
      return false;
    }
  }

  /**
   * Invalidate user permissions cache
   * Call this when user's groups or permissions change
   * 
   * @param userId - The user ID to invalidate cache for
   */
  async invalidateUserPermissionsCache(userId: string): Promise<void> {
    try {
      const cacheKey = getUserPermissionsCacheKey(userId);
      await cache.delete(cacheKey);
      logger.debug('User permissions cache invalidated', {
        module: 'PermissionService',
        extraData: { userId },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error invalidating user permissions cache', {
        module: 'PermissionService',
        extraData: {
          error: errorMessage,
          userId,
        },
      });
    }
  }

  /**
   * Get user's groups with their permissions
   * 
   * @param userId - The user ID
   * @returns Array of group objects with their permissions
   */
  async getUserGroupsWithPermissions(userId: string): Promise<
    Array<{
      group_id: string;
      name: string;
      codename: string;
      permissions: string[];
    }>
  > {
    try {
      const userGroups = await prisma.userGroup.findMany({
        where: {
          user_id: userId,
          group: {
            is_active: true,
          },
        },
        include: {
          group: {
            include: {
              permissions: {
                include: {
                  permission: {
                    select: {
                      codename: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return userGroups
        .filter((ug) => ug.group && ug.group.is_active)
        .map((ug) => ({
          group_id: ug.group.group_id,
          name: ug.group.name,
          codename: ug.group.codename || ug.group.name,
          permissions: ug.group.permissions
            .map((gp) => gp.permission?.codename)
            .filter((codename): codename is string => Boolean(codename))
            .sort(),
        }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting user groups with permissions', {
        module: 'PermissionService',
        extraData: {
          error: errorMessage,
          userId,
        },
      });
      return [];
    }
  }
}

// Export singleton instance
// Note: This is for direct database access. For API calls, use permissionService from permission.service.ts
export const permissionResolverService = new PermissionService();

