import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { updateUserPassword } from '@lib/authenticate/helpers';

/**
 * Set Password
 * POST /api/auth/set-password
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    // Allow users to set their own password with edit_profile permission
    const permissionError = await checkPermissionOrReturnError(user, 'edit_profile');
    if (permissionError) return permissionError;

    const body = await req.json();
    const { password, confirm_password } = body;

    if (!password || !confirm_password) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'password and confirm_password are required',
      });
    }

    if (password !== confirm_password) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'password and confirm_password do not match',
      });
    }

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'User ID not found',
      });
    }
    const success = await updateUserPassword(userId, confirm_password);

    if (!success) {
      return ERROR.json('AUTH_PASSWORD_UPDATE_FAILED', { user_id: userId });
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag) - password changed
    await invalidateAllUserRelatedCache(userId);

    return SUCCESS.json('Password set successfully', {
      message: 'Password set successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in set_password', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'SET_PASSWORD',
      },
    });
    return ERROR.json('AUTH_PASSWORD_UPDATE_FAILED', {}, error);
  }
}

