import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Permissions Statistics
 * GET /api/permissions/statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_permission_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchPermissionsStatisticsData = async () => {
      // Get total permissions count
    const totalPermissions = await prisma.permission.count();

    // Get permissions by module
    const permissionsByModule = await prisma.permission.groupBy({
      by: ['module'],
      _count: { permission_id: true },
    });

    // Get permissions assigned to groups
    const permissionGroupCounts = await prisma.groupPermission.groupBy({
      by: ['permission_id'],
      _count: { group_id: true },
    });

    // Get permission details with group counts
    const permissionIds = permissionGroupCounts.map((pg) => pg.permission_id);
    const permissions = await prisma.permission.findMany({
      where: { permission_id: { in: permissionIds } },
    });

    const permissionsWithStats = permissions.map((permission) => {
      const groupCount = permissionGroupCounts.find((pg) => pg.permission_id === permission.permission_id)?._count.group_id || 0;
      
      return {
        permission_id: permission.permission_id,
        name: permission.name,
        codename: permission.codename,
        module: permission.module,
        group_count: groupCount,
      };
    });

    // Get permissions not assigned to any group
    const allPermissionIds = (await prisma.permission.findMany({ select: { permission_id: true } })).map(p => p.permission_id);
    const permissionsWithGroups = new Set(permissionGroupCounts.map(pg => pg.permission_id));
    const permissionsWithoutGroups = allPermissionIds.filter(id => !permissionsWithGroups.has(id)).length;

    // Get most used permissions (assigned to most groups)
    const mostUsedPermissions = permissionsWithStats
      .sort((a, b) => b.group_count - a.group_count)
      .slice(0, 10);

    // Get least used permissions
    const leastUsedPermissions = permissionsWithStats
      .sort((a, b) => a.group_count - b.group_count)
      .slice(0, 10);

    const statistics = {
      total_permissions: totalPermissions,
      permissions_by_module: permissionsByModule.map((mod) => ({
        module: mod.module || 'uncategorized',
        count: mod._count.permission_id,
      })),
      permissions_with_groups: permissionsWithGroups.size,
      permissions_without_groups: permissionsWithoutGroups,
      total_group_assignments: permissionGroupCounts.reduce((sum, pg) => sum + pg._count.group_id, 0),
      most_used_permissions: mostUsedPermissions,
      least_used_permissions: leastUsedPermissions,
      permissions_detail: permissionsWithStats.sort((a, b) => b.group_count - a.group_count),
    };

      return { statistics };
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const result = forceRefresh
      ? await reCache(fetchPermissionsStatisticsData, {
          key: getDashboardStatisticsCacheKey('permissions-statistics'),
          duration: 'long', // Cache for 1 hour
        })
      : await withCache(fetchPermissionsStatisticsData, {
          key: getDashboardStatisticsCacheKey('permissions-statistics'),
          duration: 'long', // Cache for 1 hour
        });

    return SUCCESS.json('Permissions statistics retrieved successfully', result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting permissions statistics', {
      module: 'Permissions',
      label: 'GET_PERMISSIONS_STATISTICS',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
