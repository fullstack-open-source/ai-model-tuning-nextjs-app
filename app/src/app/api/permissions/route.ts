import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getPermissionsCacheKey } from '@lib/cache/keys';
import { invalidatePermissionsCache } from '@lib/cache/invalidation';
import { prisma } from '@lib/db/prisma';

/**
 * Get all permissions
 * GET /api/permissions
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_permission');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchPermissionsData = async () => {
      return await prisma.permission.findMany({
        orderBy: { created_at: 'desc' },
      });
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const permissions = forceRefresh
      ? await reCache(fetchPermissionsData, {
          key: getPermissionsCacheKey(),
          duration: 'very_long', // Cache for 1 day (permissions change very infrequently)
        })
      : await withCache(fetchPermissionsData, {
          key: getPermissionsCacheKey(),
          duration: 'very_long', // Cache for 1 day (permissions change very infrequently)
        });

    return SUCCESS.json('Permissions retrieved successfully', { permissions });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting permissions', { module: 'Permissions', label: 'GET_PERMISSIONS', extraData: { error: errorMessage } });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Create new permission
 * POST /api/permissions
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'add_permission');
    if (permissionError) return permissionError;

    const body = await req.json();
    const { name, codename, description, category } = body;
    
    if (!name || !codename) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', { message: 'name and codename are required' });
    }
    
    const permission = await prisma.permission.create({
      data: { name, codename, description, module: category },
    });

    // Invalidate permissions cache (respects REDIS_CACHE_ENABLED flag)
    await invalidatePermissionsCache();

    return SUCCESS.json('Permission created successfully', { permission }, {}, 201);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating permission', { module: 'Permissions', label: 'CREATE_PERMISSION', extraData: { error: errorMessage } });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return ERROR.json('DUPLICATE_ENTRY', { message: 'Permission with this name or codename already exists' });
    }
    return ERROR.json('PERMISSION_CREATE_FAILED', {}, error);
  }
}

