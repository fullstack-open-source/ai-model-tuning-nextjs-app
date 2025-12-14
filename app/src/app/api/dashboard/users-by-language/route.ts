import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Users by Language
 * GET /api/dashboard/users-by-language
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchUsersByLanguageData = async () => {
      const statsResult = await prisma.user.groupBy({
        by: ['language'],
        _count: { language: true },
        orderBy: { _count: { language: 'desc' } },
      });

      return statsResult.map((row: { language: string | null; _count: { language: number } }) => ({
        language: row.language || 'unknown',
        count: row._count.language,
      }));
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const stats = forceRefresh
      ? await reCache(fetchUsersByLanguageData, {
          key: getDashboardStatisticsCacheKey('users-by-language'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchUsersByLanguageData, {
          key: getDashboardStatisticsCacheKey('users-by-language'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('User statistics by language retrieved successfully', {
      users_by_language: stats,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in users by language', {
      module: 'Dashboard',
      extraData: {
        error: errorMessage,
        label: 'USERS_BY_LANGUAGE',
      },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}
