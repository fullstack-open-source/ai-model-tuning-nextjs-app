import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { invalidateDashboardCache } from '@lib/cache/invalidation';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get all dashboard statistics
 * GET /api/dashboard/all-statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchAllStatisticsData = async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const [
          totalUsers,
          activeUsers,
          verifiedUsers,
          emailVerified,
          phoneVerified,
          newToday,
          newThisWeek,
          newThisMonth,
          byStatus,
          byType,
          byAuthType
        ] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { is_active: true } }),
          prisma.user.count({ where: { is_verified: true } }),
          prisma.user.count({ where: { email_verified: true } }),
          prisma.user.count({ where: { phone_verified: true } }),
          prisma.user.count({ where: { created_at: { gte: today, lt: tomorrow } } }),
          prisma.user.count({ where: { created_at: { gte: weekAgo } } }),
          prisma.user.count({ where: { created_at: { gte: monthStart } } }),
          prisma.user.groupBy({ by: ['account_status'], _count: { account_status: true } }),
          prisma.user.groupBy({ by: ['auth_type'], _count: { auth_type: true } }),
          prisma.user.groupBy({ by: ['auth_type'], _count: { auth_type: true } })
        ]);
        
        return {
          overview: {
            total_users: totalUsers,
            active_users: activeUsers,
            verified_users: verifiedUsers,
            email_verified: emailVerified,
            phone_verified: phoneVerified,
            new_users: {
              today: newToday,
              this_week: newThisWeek,
              this_month: newThisMonth
            }
          },
          by_status: byStatus.map((r: { account_status: string | null; _count: { account_status: number } }) => ({ status: r.account_status, count: r._count.account_status })),
          by_auth_type: byAuthType.map((r: { auth_type: string | null; _count: { auth_type: number } }) => ({ auth_type: r.auth_type || 'unknown', count: r._count.auth_type })),
        };
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const stats = forceRefresh
      ? await reCache(fetchAllStatisticsData, {
          key: getDashboardStatisticsCacheKey('all-statistics'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchAllStatisticsData, {
          key: getDashboardStatisticsCacheKey('all-statistics'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('All dashboard statistics retrieved successfully', stats);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error in all statistics', { module: 'Dashboard', label: 'ALL_STATISTICS', extraData: { error: errorMessage, stack: errorStack } });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}

