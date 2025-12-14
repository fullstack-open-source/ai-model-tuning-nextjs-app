import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getGroupsCacheKey } from '@lib/cache/keys';
import { invalidateGroupsCache } from '@lib/cache/invalidation';
import { prisma } from '@lib/db/prisma';

/**
 * Get all groups
 * GET /api/groups
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_group');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchGroupsData = async () => {
      return await prisma.group.findMany({
        orderBy: { created_at: 'desc' },
      });
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const groups = forceRefresh
      ? await reCache(fetchGroupsData, {
          key: getGroupsCacheKey(),
          duration: 'very_long', // Cache for 1 day (groups change very infrequently)
        })
      : await withCache(fetchGroupsData, {
          key: getGroupsCacheKey(),
          duration: 'very_long', // Cache for 1 day (groups change very infrequently)
        });

    return SUCCESS.json('Groups retrieved successfully', { groups });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting groups', { module: 'Permissions', label: 'GET_GROUPS', extraData: { error: errorMessage } });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Create new group
 * POST /api/groups
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'add_group');
    if (permissionError) return permissionError;

    const body = await req.json();
    const { name, description, is_default } = body;
    
    if (!name) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', { message: 'name is required' });
    }
    
    const group = await prisma.group.create({
      data: { name, description, is_default },
    });

    // Invalidate groups cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateGroupsCache();

    return SUCCESS.json('Group created successfully', { group }, {}, 201);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating group', { module: 'Permissions', label: 'CREATE_GROUP', extraData: { error: errorMessage } });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return ERROR.json('DUPLICATE_ENTRY', { message: 'Group with this name or codename already exists' });
    }
    return ERROR.json('GROUP_CREATE_FAILED', {}, error);
  }
}

