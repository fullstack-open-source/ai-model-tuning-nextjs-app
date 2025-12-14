import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Update Theme
 * POST /api/settings/update-theme
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'update_theme');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const body = await req.json();
    const { theme } = body;

    if (!theme || !['light', 'dark', 'dynamic'].includes(theme)) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'theme must be "light", "dark", or "dynamic"',
      });
    }

    try {
      await prisma.user.update({
        where: { user_id: userId },
        data: { theme },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return ERROR.json('PROFILE_UPDATE_FAILED', { user_id: userId });
      }
      throw error;
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateAllUserRelatedCache(userId);

    const userData = await getUserByUserId(userId);
    if (!userData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }
    const serializedData = serializeData(userData);

    return SUCCESS.json('Theme updated successfully', serializedData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating theme', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_THEME',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}
