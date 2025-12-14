import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getGroupCacheKey } from '@lib/cache/keys';
import { invalidateGroupsCache } from '@lib/cache/invalidation';
import { getGroupById, updateGroup, deleteGroup } from '@lib/permissions/helpers';

/**
 * Get Group by ID
 * GET /api/groups/{group_id}
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ group_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_group');
    if (permissionError) return permissionError;

    const { group_id } = await params;
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchGroupData = async () => {
      return await getGroupById(group_id);
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const group = forceRefresh
      ? await reCache(fetchGroupData, {
          key: getGroupCacheKey(group_id),
          duration: 'very_long', // Cache for 1 day
        })
      : await withCache(fetchGroupData, {
          key: getGroupCacheKey(group_id),
          duration: 'very_long', // Cache for 1 day
        });

    if (!group) {
      return ERROR.json('GROUP_NOT_FOUND', { group_id });
    }

    return SUCCESS.json('Group retrieved successfully', { group });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting group', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'GET_GROUP',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Update Group
 * PUT /api/groups/{group_id}
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ group_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'edit_group');
    if (permissionError) return permissionError;

    const { group_id } = await params;
    const body = await req.json();
    const group = await updateGroup(group_id, body);

    if (!group) {
      return ERROR.json('GROUP_NOT_FOUND', { group_id });
    }

    // Invalidate group caches (respects REDIS_CACHE_ENABLED flag)
    await invalidateGroupsCache(group_id);

    return SUCCESS.json('Group updated successfully', { group });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating group', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_GROUP',
      },
    });
    if (error instanceof Error && error.message.includes('P2025')) {
      const { group_id: gid } = await params;
      return ERROR.json('GROUP_NOT_FOUND', { group_id: gid });
    }
    return ERROR.json('GROUP_UPDATE_FAILED', {}, error);
  }
}

/**
 * Delete Group
 * DELETE /api/groups/{group_id}
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ group_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'delete_group');
    if (permissionError) return permissionError;

    const { group_id } = await params;
    const deleted = await deleteGroup(group_id);

    if (!deleted) {
      return ERROR.json('GROUP_DELETE_FAILED', {
        message: 'Group not found or is a system group',
      });
    }

    // Invalidate group caches (respects REDIS_CACHE_ENABLED flag)
    await invalidateGroupsCache(group_id);

    return SUCCESS.json('Group deleted successfully', { group_id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting group', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'DELETE_GROUP',
      },
    });
    if (error instanceof Error && error.message.includes('P2025')) {
      const { group_id: gid } = await params;
      return ERROR.json('GROUP_NOT_FOUND', { group_id: gid });
    }
    return ERROR.json('GROUP_DELETE_FAILED', {}, error);
  }
}
