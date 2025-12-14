import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Users by Auth Type
 * GET /api/dashboard/users-by-auth-type
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchUsersByAuthTypeData = async () => {
      const statsResult = await prisma.user.groupBy({
        by: ['auth_type'],
        _count: { auth_type: true },
        orderBy: { _count: { auth_type: 'desc' } },
      });

      return statsResult.map((row: { auth_type: string | null; _count: { auth_type: number } }) => ({
        auth_type: row.auth_type || 'unknown',
        count: row._count.auth_type,
      }));
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const stats = forceRefresh
      ? await reCache(fetchUsersByAuthTypeData, {
          key: getDashboardStatisticsCacheKey('users-by-auth-type'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchUsersByAuthTypeData, {
          key: getDashboardStatisticsCacheKey('users-by-auth-type'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('User statistics by auth type retrieved successfully', {
      users_by_auth_type: stats,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in users by auth type', {
      module: 'Dashboard',
      extraData: {
        error: errorMessage,
        label: 'USERS_BY_AUTH_TYPE',
      },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}
