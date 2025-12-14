import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Activity Logs Statistics
 * GET /api/dashboard/activity-stats
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchActivityStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      const [
        totalLogs,
        byLevel,
        byModule,
        byActionRaw,
        logsToday,
        logsThisWeek,
        logsThisMonth,
        errorLogs,
      ] = await Promise.all([
        prisma.activityLog.count(),
        prisma.activityLog.groupBy({
          by: ['level'],
          _count: { level: true },
        }),
        prisma.activityLog.groupBy({
          by: ['module'],
          _count: { module: true },
        }),
        prisma.activityLog.groupBy({
          by: ['action'],
          _count: { action: true },
          where: {
            action: { not: null }
          },
        }),
        prisma.activityLog.count({
          where: { created_at: { gte: today } },
        }),
        prisma.activityLog.count({
          where: { created_at: { gte: weekAgo } },
        }),
        prisma.activityLog.count({
          where: { created_at: { gte: monthAgo } },
        }),
        prisma.activityLog.count({
          where: { level: 'error' },
        }),
      ]);

      // Limit byAction to top 10
      const byAction = byActionRaw.slice(0, 10);

      return {
        total: totalLogs,
        by_level: byLevel.map((r: { level: string; _count: { level: number } }) => ({
          level: r.level,
          count: r._count.level,
        })),
        by_module: byModule.map((r: { module: string | null; _count: { module: number } }) => ({
          module: r.module || 'unknown',
          count: r._count.module,
        })),
        by_action: byAction.map((r: { action: string | null; _count: { action: number } }) => ({
          action: r.action || 'unknown',
          count: r._count.action,
        })),
        today: logsToday,
        this_week: logsThisWeek,
        this_month: logsThisMonth,
        errors: errorLogs,
      };
    };

    const stats = forceRefresh
      ? await reCache(fetchActivityStats, {
          key: getDashboardStatisticsCacheKey('activity-stats'),
          duration: 'long',
        })
      : await withCache(fetchActivityStats, {
          key: getDashboardStatisticsCacheKey('activity-stats'),
          duration: 'long',
        });

    return SUCCESS.json('Activity statistics retrieved successfully', stats);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in activity stats', {
      module: 'Dashboard',
      extraData: { error: errorMessage, label: 'ACTIVITY_STATS' },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}

