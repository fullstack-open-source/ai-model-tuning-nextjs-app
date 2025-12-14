import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get User Growth Statistics
 * GET /api/dashboard/user-growth
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'daily';
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchUserGrowthData = async () => {
        try {
          let queryResult;

          if (period === 'daily') {
          const daysLimit = Math.min(Math.max(1, days), 365);
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysLimit);
          startDate.setHours(0, 0, 0, 0); // Start of day
          
          queryResult = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
            SELECT 
              DATE(created_at) as date,
              COUNT(*)::int as count
            FROM "users"
            WHERE created_at >= ${startDate}
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `;
        } else if (period === 'weekly') {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 84); // 12 weeks
          startDate.setHours(0, 0, 0, 0);
          
          queryResult = await prisma.$queryRaw<Array<{ week: Date; count: number }>>`
            SELECT 
              DATE_TRUNC('week', created_at) as week,
              COUNT(*)::int as count
            FROM "users"
            WHERE created_at >= ${startDate}
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY week ASC
          `;
        } else {
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 12);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          
          queryResult = await prisma.$queryRaw<Array<{ month: Date; count: number }>>`
            SELECT 
              DATE_TRUNC('month', created_at) as month,
              COUNT(*)::int as count
            FROM "users"
            WHERE created_at >= ${startDate}
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month ASC
          `;
        }

          return queryResult.map((row: { date?: Date; week?: Date; month?: Date; count: number }) => ({
            period: period === 'daily' ? row.date : period === 'weekly' ? row.week : row.month,
            count: row.count || 0,
          }));
        } catch (dbError: unknown) {
          const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
          logger.error('Database error in fetchUserGrowthData', {
            module: 'Dashboard',
            extraData: { error: errorMessage, period, days },
          });
          // Return empty array on error instead of throwing
          return [];
        }
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const result = forceRefresh
      ? await reCache(fetchUserGrowthData, {
          key: getDashboardStatisticsCacheKey(`user-growth:${period}:${days}`),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchUserGrowthData, {
          key: getDashboardStatisticsCacheKey(`user-growth:${period}:${days}`),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('User growth statistics retrieved successfully', {
      period: period,
      growth: result,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in user growth', {
      module: 'Dashboard',
      extraData: {
        error: errorMessage,
        label: 'USER_GROWTH',
      },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}
