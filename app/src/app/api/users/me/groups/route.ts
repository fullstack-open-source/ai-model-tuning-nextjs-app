import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { withCache, reCache } from '@lib/middleware/cache';
import { getUserGroupsCacheKey } from '@lib/cache/keys';
import { getUserGroups } from '@lib/middleware/permissions';

/**
 * Get Current User's Groups
 * GET /api/users/me/groups
 * 
 * Returns an array of group objects with group_id, name, codename, etc.
 * The codename field is essential for permission checking (e.g., 'super_admin', 'admin').
 * 
 * NOTE: No permission check required - users should always be able to view their own groups.
 * This prevents the chicken-and-egg problem where fetching permissions requires permissions.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    // No permission check - users can always view their own groups

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchMyGroupsData = async () => {
      const groups = await getUserGroups(userId);
      // Ensure codename is always present (fallback to name if missing)
      return groups.map(g => ({
        ...g,
        codename: g.codename || g.name?.toLowerCase().replace(/\s+/g, '_') || g.name,
      }));
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const groups = forceRefresh
      ? await reCache(fetchMyGroupsData, {
          key: getUserGroupsCacheKey(userId),
          duration: 'very_long', // Cache for 1 day (groups change infrequently)
        })
      : await withCache(fetchMyGroupsData, {
          key: getUserGroupsCacheKey(userId),
          duration: 'very_long', // Cache for 1 day (groups change infrequently)
        });

    logger.debug('User groups retrieved', {
      module: 'Permissions',
      extraData: {
        userId,
        groupCount: groups?.length || 0,
        groupCodenames: groups?.map((g: any) => g.codename) || [],
        forceRefresh,
      },
    });

    return SUCCESS.json('Current user groups retrieved successfully', { groups });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting current user groups', {
      module: 'Permissions',
      extraData: {
        error: errorMessage,
        label: 'GET_MY_GROUPS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
