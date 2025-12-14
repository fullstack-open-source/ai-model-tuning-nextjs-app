import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Groups Statistics
 * GET /api/groups/statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_group_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchGroupsStatisticsData = async () => {
      // Get total groups count
    const totalGroups = await prisma.group.count();
    const defaultGroups = await prisma.group.count({ where: { is_default: true } });
    const customGroups = totalGroups - defaultGroups;

    // Get user counts per group
    const userGroupCounts = await prisma.userGroup.groupBy({
      by: ['group_id'],
      _count: { user_id: true },
    });

    // Get group details with user counts
    const groupIds = userGroupCounts.map((ug) => ug.group_id);
    const groups = await prisma.group.findMany({
      where: { group_id: { in: groupIds } },
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                permission_id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const groupsWithStats = groups.map((group) => {
      const userCount = userGroupCounts.find((ug) => ug.group_id === group.group_id)?._count.user_id || 0;
      const permissionCount = group.permissions.length;
      
      return {
        group_id: group.group_id,
        name: group.name,
        is_default: group.is_default,
        user_count: userCount,
        permission_count: permissionCount,
      };
    });

    // Get groups with no users
    const allGroupIds = (await prisma.group.findMany({ select: { group_id: true } })).map(g => g.group_id);
    const groupsWithUsers = new Set(userGroupCounts.map(ug => ug.group_id));
    const groupsWithoutUsers = allGroupIds.filter(id => !groupsWithUsers.has(id)).length;

    // Group by category (default vs custom)
    const statistics = {
      total_groups: totalGroups,
      default_groups: defaultGroups,
      custom_groups: customGroups,
      groups_with_users: groupsWithUsers.size,
      groups_without_users: groupsWithoutUsers,
      total_users_in_groups: userGroupCounts.reduce((sum, ug) => sum + ug._count.user_id, 0),
      groups_detail: groupsWithStats.sort((a, b) => b.user_count - a.user_count),
    };

      return { statistics };
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const result = forceRefresh
      ? await reCache(fetchGroupsStatisticsData, {
          key: getDashboardStatisticsCacheKey('groups-statistics'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchGroupsStatisticsData, {
          key: getDashboardStatisticsCacheKey('groups-statistics'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('Groups statistics retrieved successfully', result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting groups statistics', {
      module: 'Permissions',
      label: 'GET_GROUPS_STATISTICS',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
