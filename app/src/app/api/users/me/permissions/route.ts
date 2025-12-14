import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { withCache, reCache } from '@lib/middleware/cache';
import { getUserPermissionsCacheKey } from '@lib/cache/keys';
import { permissionResolverService } from '@services/PermissionService';

/**
 * Get Current User's Permissions
 * GET /api/users/me/permissions
 * 
 * Returns an array of permission codenames (strings) for the authenticated user.
 * This is consistent with the login API response format.
 * 
 * NOTE: No permission check required - users should always be able to view their own permissions.
 * This prevents the chicken-and-egg problem where fetching permissions requires permissions.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    // No permission check - users can always view their own permissions

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function - uses PermissionService for consistent string[] response
    const fetchMyPermissionsData = async () => {
      // forceRefresh=true bypasses the internal cache in PermissionService
      return await permissionResolverService.getUserPermissions(userId, forceRefresh);
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const permissions = forceRefresh
      ? await reCache(fetchMyPermissionsData, {
          key: getUserPermissionsCacheKey(userId),
          duration: 'very_long', // Cache for 1 day (permissions change infrequently)
        })
      : await withCache(fetchMyPermissionsData, {
          key: getUserPermissionsCacheKey(userId),
          duration: 'very_long', // Cache for 1 day (permissions change infrequently)
        });

    logger.debug('User permissions retrieved', {
      module: 'Permissions',
      extraData: {
        userId,
        permissionCount: permissions?.length || 0,
        forceRefresh,
      },
    });

    return SUCCESS.json('Current user permissions retrieved successfully', { permissions });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting current user permissions', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'GET_MY_PERMISSIONS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
