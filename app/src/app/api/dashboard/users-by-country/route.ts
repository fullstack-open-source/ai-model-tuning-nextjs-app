import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Users by Country
 * GET /api/dashboard/users-by-country
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchUsersByCountryData = async () => {
      const statsResult = await prisma.user.groupBy({
        by: ['country'],
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: 20,
      });

      return statsResult.map((row: { country: string | null; _count: { country: number } }) => ({
        country: row.country || 'unknown',
        count: row._count.country,
      }));
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const stats = forceRefresh
      ? await reCache(fetchUsersByCountryData, {
          key: getDashboardStatisticsCacheKey('users-by-country'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchUsersByCountryData, {
          key: getDashboardStatisticsCacheKey('users-by-country'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('User statistics by country retrieved successfully', {
      users_by_country: stats,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in users by country', {
      module: 'Dashboard',
      extraData: {
        error: errorMessage,
        label: 'USERS_BY_COUNTRY',
      },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}
