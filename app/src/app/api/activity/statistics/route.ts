import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getActivityStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get activity statistics
 * GET /api/activity/statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_activity_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const user_id = url.searchParams.get('user_id') || undefined;
    const start_date = url.searchParams.get('start_date') || undefined;
    const end_date = url.searchParams.get('end_date') || undefined;
    const forceRefresh = url.searchParams.has('_refresh');

    // Generate cache key based on filters
    const cacheKey = getActivityStatisticsCacheKey({
      user_id,
      start_date,
      end_date,
    });

    // Define the data fetcher function
    const fetchActivityStatisticsData = async () => {
        const startDate = start_date ? new Date(start_date) : undefined;
        const endDate = end_date ? new Date(end_date) : undefined;

        const where: Record<string, unknown> = {};
        if (user_id) where.user_id = user_id;
        if (startDate || endDate) {
          where.created_at = {};
          if (startDate) where.created_at = { ...where.created_at as Record<string, unknown>, gte: startDate };
          if (endDate) where.created_at = { ...where.created_at as Record<string, unknown>, lte: endDate };
        }

        const [
          total,
          byLevel,
          byAction,
          byModule,
        ] = await Promise.all([
          prisma.activityLog.count({ where }),
          prisma.activityLog.groupBy({
            by: ['level'],
            where,
            _count: { level: true },
          }),
          prisma.activityLog.groupBy({
            by: ['action'],
            where,
            _count: { action: true },
          }),
          prisma.activityLog.groupBy({
            by: ['module'],
            where,
            _count: { module: true },
          }),
        ]);

        // Convert arrays to Record format for the frontend
        const byLevelRecord: Record<string, number> = {};
        byLevel.forEach((item: { level: string | null; _count: { level: number } }) => {
          if (item.level) byLevelRecord[item.level] = item._count.level;
        });

        const byActionRecord: Record<string, number> = {};
        byAction.forEach((item: { action: string | null; _count: { action: number } }) => {
          if (item.action) byActionRecord[item.action] = item._count.action;
        });

        const byModuleRecord: Record<string, number> = {};
        byModule.forEach((item: { module: string | null; _count: { module: number } }) => {
          if (item.module) byModuleRecord[item.module] = item._count.module;
        });

        return {
          total_logs: total,
          by_level: byLevelRecord,
          by_action: byActionRecord,
          by_module: byModuleRecord,
        };
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const statistics = forceRefresh
      ? await reCache(fetchActivityStatisticsData, {
          key: cacheKey,
          duration: 'short', // Cache for 5 minutes (statistics change frequently)
        })
      : await withCache(fetchActivityStatisticsData, {
          key: cacheKey,
          duration: 'short', // Cache for 5 minutes (statistics change frequently)
        });

    return SUCCESS.json('Activity statistics retrieved successfully', { statistics });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting activity statistics', { module: 'ActivityLog', label: 'GET_ACTIVITY_STATISTICS', extraData: { error: errorMessage } });
    return ERROR.json('ACTIVITY_LOG_QUERY_FAILED', {}, error);
  }
}

