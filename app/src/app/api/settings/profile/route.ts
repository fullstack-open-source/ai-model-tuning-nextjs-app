import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getUserProfileCacheKey } from '@lib/cache/keys';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';

/**
 * Get User Profile
 * GET /api/settings/profile
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_profile');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchProfileData = async () => {
      const userData = await getUserByUserId(userId);
      if (!userData) {
        throw new Error('User not found');
      }
      return serializeData(userData);
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const serializedData = forceRefresh
      ? await reCache(fetchProfileData, {
          key: getUserProfileCacheKey(userId),
          duration: 'medium', // Cache for 15 minutes (profile changes moderately)
        })
      : await withCache(fetchProfileData, {
          key: getUserProfileCacheKey(userId),
          duration: 'medium', // Cache for 15 minutes (profile changes moderately)
        });

    return SUCCESS.json('User profile fetched successfully', serializedData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error fetching profile', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'GET_PROFILE',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}

