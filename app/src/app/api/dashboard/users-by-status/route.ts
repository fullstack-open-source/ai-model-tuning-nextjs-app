import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Users by Status
 * GET /api/dashboard/users-by-status
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchUsersByStatusData = async () => {
      const statsResult = await prisma.user.groupBy({
        by: ['account_status'],
        _count: { account_status: true },
        orderBy: { _count: { account_status: 'desc' } },
      });

      return statsResult.map((row: { account_status: string | null; _count: { account_status: number } }) => ({
        status: row.account_status,
        count: row._count.account_status,
      }));
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const stats = forceRefresh
      ? await reCache(fetchUsersByStatusData, {
          key: getDashboardStatisticsCacheKey('users-by-status'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchUsersByStatusData, {
          key: getDashboardStatisticsCacheKey('users-by-status'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('User statistics by status retrieved successfully', {
      users_by_status: stats,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in users by status', {
      module: 'Dashboard',
      extraData: {
        error: errorMessage,
        label: 'USERS_BY_STATUS',
      },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}
