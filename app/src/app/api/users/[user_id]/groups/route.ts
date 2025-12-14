import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getUserGroupsCacheKey } from '@lib/cache/keys';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { activityLogService } from '@services/ActivityLogService';
import { getUserGroups, assignGroupsToUser } from '@lib/middleware/permissions';

/**
 * Get User's Groups
 * GET /api/users/{user_id}/groups
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_user_groups');
    if (permissionError) return permissionError;

    const { user_id } = await params;
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchUserGroupsData = async () => {
      return await getUserGroups(user_id);
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const groups = forceRefresh
      ? await reCache(fetchUserGroupsData, {
          key: getUserGroupsCacheKey(user_id),
          duration: 'very_long', // Cache for 1 day (groups change infrequently)
        })
      : await withCache(fetchUserGroupsData, {
          key: getUserGroupsCacheKey(user_id),
          duration: 'very_long', // Cache for 1 day (groups change infrequently)
        });

    return SUCCESS.json('User groups retrieved successfully', { groups });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting user groups', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'GET_USER_GROUPS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Assign Groups to User
 * POST /api/users/{user_id}/groups
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'assign_user_groups');
    if (permissionError) return permissionError;

    const { user_id } = await params;
    const body = await req.json();
    const { group_codenames } = body;

    if (!group_codenames || !Array.isArray(group_codenames)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'group_codenames must be an array',
      });
    }

    const currentUserId = user.uid || user.user_id;
    await assignGroupsToUser(user_id, group_codenames, currentUserId || null);

    // Invalidate user groups cache and all user-related cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateAllUserRelatedCache(user_id);

    // Create activity log
    await activityLogService.logAssign(
      currentUserId || null,
      'users',
      'user_groups',
      user_id,
      user_id, // assigned_to (the user receiving the groups)
      {
        group_codenames,
        assigned_by: currentUserId,
      },
      { headers: req.headers, url: req.url, method: 'POST' }
    );

    return SUCCESS.json('Groups assigned to user successfully', {
      user_id,
      group_codenames,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error assigning groups to user', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'ASSIGN_GROUPS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
