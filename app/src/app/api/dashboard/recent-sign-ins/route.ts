import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Recent Sign-ins
 * GET /api/dashboard/recent-sign-ins
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchRecentSignInsData = async () => {
        const recentSignIns = await prisma.user.findMany({
          where: {
            last_login: { not: null },
          },
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            last_login: true,
            is_active: true,
          },
          orderBy: {
            last_login: 'desc',
          },
          take: Math.min(limit, 100),
        });

        return recentSignIns.map((user) => ({
          user_id: user.user_id,
          user_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
          email: user.email,
          phone_number: user.phone_number,
          last_sign_in_at: user.last_login?.toISOString() || null,
          is_active: user.is_active ?? false,
        }));
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const signIns = forceRefresh
      ? await reCache(fetchRecentSignInsData, {
          key: getDashboardStatisticsCacheKey(`recent-sign-ins:${limit}`),
          duration: 'short', // Cache for 5 minutes (sign-ins change frequently)
        })
      : await withCache(fetchRecentSignInsData, {
          key: getDashboardStatisticsCacheKey(`recent-sign-ins:${limit}`),
          duration: 'short', // Cache for 5 minutes (sign-ins change frequently)
        });

    return SUCCESS.json('Recent sign-ins retrieved successfully', {
      recent_sign_ins: signIns,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in recent sign-ins', {
      module: 'Dashboard',
      extraData: {
        error: errorMessage,
        label: 'RECENT_SIGN_INS',
      },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}
