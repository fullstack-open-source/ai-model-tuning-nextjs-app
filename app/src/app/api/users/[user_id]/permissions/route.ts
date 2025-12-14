import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { getUserPermissionsCacheKey } from '@lib/cache/keys';
import { getUserPermissions } from '@lib/middleware/permissions';

/**
 * Get User's Permissions
 * GET /api/users/{user_id}/permissions
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_user_permissions');
    if (permissionError) return permissionError;

    const { user_id } = await params;
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchUserPermissionsData = async () => {
      return await getUserPermissions(user_id);
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const permissions = forceRefresh
      ? await reCache(fetchUserPermissionsData, {
          key: getUserPermissionsCacheKey(user_id),
          duration: 'very_long', // Cache for 1 day (permissions change infrequently)
        })
      : await withCache(fetchUserPermissionsData, {
          key: getUserPermissionsCacheKey(user_id),
          duration: 'very_long', // Cache for 1 day (permissions change infrequently)
        });

    return SUCCESS.json('User permissions retrieved successfully', { permissions });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting user permissions', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'GET_USER_PERMISSIONS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
