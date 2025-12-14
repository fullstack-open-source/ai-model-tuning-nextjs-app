import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateGroupsCache, invalidatePermissionsCache } from '@lib/cache/invalidation';
import { assignPermissionsToGroup } from '@lib/permissions/helpers';
import { permissionResolverService } from '@services/PermissionService';
import { cache } from '@lib/cache/cache';
import { getUserPermissionsCachePattern } from '@lib/cache/keys';

/**
 * Assign Permissions to Group
 * POST /api/groups/{group_id}/permissions
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ group_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'assign_group_permissions');
    if (permissionError) return permissionError;

    const { group_id } = await params;
    const body = await req.json();
    const { permission_ids } = body;

    if (!permission_ids || !Array.isArray(permission_ids)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'permission_ids must be an array',
      });
    }

    await assignPermissionsToGroup(group_id, permission_ids);

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateGroupsCache(group_id);
    await invalidatePermissionsCache();

    // Invalidate all user permissions cache since group permissions changed
    // This ensures all users with this group get fresh permissions
    try {
      const deletedCount = await cache.deleteByPattern(getUserPermissionsCachePattern());
      logger.debug('User permissions cache invalidated after group permission change', {
        module: 'Permissions',
        extraData: {
          group_id,
          deletedKeys: deletedCount,
        },
      });
    } catch (cacheError: unknown) {
      const cacheErrorMessage = cacheError instanceof Error ? cacheError.message : 'Unknown error';
      logger.warning(`Failed to invalidate user permissions cache: ${cacheErrorMessage}`, {
        module: 'Permissions',
        extraData: { group_id },
      });
      // Don't fail the operation if cache invalidation fails
    }

    return SUCCESS.json('Permissions assigned to group successfully', {
      group_id,
      permission_ids,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error assigning permissions to group', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'ASSIGN_PERMISSIONS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
