import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getPermissionCacheKey } from '@lib/cache/keys';
import { invalidatePermissionsCache } from '@lib/cache/invalidation';
import { prisma } from '@lib/db/prisma';

/**
 * Get permission by ID
 * GET /api/permissions/[permission_id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ permission_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_permission');
    if (permissionError) return permissionError;

    const { permission_id } = await params;
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchPermissionData = async () => {
      return await prisma.permission.findUnique({
        where: { permission_id },
      });
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const permission = forceRefresh
      ? await reCache(fetchPermissionData, {
          key: getPermissionCacheKey(permission_id),
          duration: 'very_long', // Cache for 1 day
        })
      : await withCache(fetchPermissionData, {
          key: getPermissionCacheKey(permission_id),
          duration: 'very_long', // Cache for 1 day
        });
    
    if (!permission) {
      return ERROR.json('USER_NOT_FOUND', { permission_id });
    }
    
    return SUCCESS.json('Permission retrieved successfully', { permission });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting permission', { module: 'Permissions', label: 'GET_PERMISSION', extraData: { error: errorMessage } });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Update permission
 * PUT /api/permissions/[permission_id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ permission_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'edit_permission');
    if (permissionError) return permissionError;

    const { permission_id } = await params;
    const body = await req.json();
    
    const permission = await prisma.permission.update({
      where: { permission_id },
      data: body,
    });
    
    // Invalidate permission caches (respects REDIS_CACHE_ENABLED flag)
    await invalidatePermissionsCache(permission_id);
    
    return SUCCESS.json('Permission updated successfully', { permission });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating permission', { module: 'Permissions', label: 'UPDATE_PERMISSION', extraData: { error: errorMessage } });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      const { permission_id: pid } = await params;
      return ERROR.json('PERMISSION_NOT_FOUND', { permission_id: pid });
    }
    return ERROR.json('PERMISSION_UPDATE_FAILED', {}, error);
  }
}

/**
 * Delete permission
 * DELETE /api/permissions/[permission_id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ permission_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'delete_permission');
    if (permissionError) return permissionError;

    const { permission_id } = await params;
    await prisma.permission.delete({
      where: { permission_id },
    });
    
    // Invalidate permission caches (respects REDIS_CACHE_ENABLED flag)
    await invalidatePermissionsCache(permission_id);
    
    return SUCCESS.json('Permission deleted successfully', { permission_id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting permission', { module: 'Permissions', label: 'DELETE_PERMISSION', extraData: { error: errorMessage } });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      const { permission_id: pid } = await params;
      return ERROR.json('PERMISSION_NOT_FOUND', { permission_id: pid });
    }
    return ERROR.json('PERMISSION_DELETE_FAILED', {}, error);
  }
}

