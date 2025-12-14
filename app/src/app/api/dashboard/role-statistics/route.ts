import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Role Statistics
 * GET /api/dashboard/role-statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchRoleStatisticsData = async () => {
        // Get user counts by group
        const userGroups = await prisma.userGroup.groupBy({
          by: ['group_id'],
          _count: { user_id: true },
        });

        // Get group details
        const groupIds = userGroups.map((ug: { group_id: string }) => ug.group_id);
        const groups = await prisma.group.findMany({
          where: { group_id: { in: groupIds } },
          select: { group_id: true, name: true },
        });

        return userGroups.map((ug: { group_id: string; _count: { user_id: number } }) => {
          const group = groups.find((g: { group_id: string }) => g.group_id === ug.group_id);
          return {
            role: group?.name || 'Unknown',
            count: ug._count.user_id,
          };
        });
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const roleStats = forceRefresh
      ? await reCache(fetchRoleStatisticsData, {
          key: getDashboardStatisticsCacheKey('role-statistics'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchRoleStatisticsData, {
          key: getDashboardStatisticsCacheKey('role-statistics'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('Role statistics retrieved successfully', {
      role_statistics: roleStats,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in role statistics', {
      module: 'Dashboard',
      extraData: {
        error: errorMessage,
        label: 'ROLE_STATISTICS',
      },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}
