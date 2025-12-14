import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError, hasPermission } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { authenticateUser, updateUserPassword } from '@lib/authenticate/helpers';

/**
 * Change Password
 * POST /api/auth/change-password
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    // Allow users to change their own password with edit_profile permission
    const permissionError = await checkPermissionOrReturnError(user, 'edit_profile');
    if (permissionError) return permissionError;

    const body = await req.json();
    const { user_id, old_password, password, confirm_password } = body;

    if (!old_password || !password || !confirm_password) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'old_password, password, and confirm_password are required',
      });
    }

    if (password !== confirm_password) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'password and confirm_password do not match',
      });
    }

    const currentUserId = user.uid || user.user_id;
    if (!currentUserId) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'User ID not found',
      });
    }

    // Determine target user ID - users can only change their own password unless they're admin
    const targetUserId = user_id || currentUserId;
    const isAdmin = await hasPermission(user, 'manage_auth') || 
                    await hasPermission(user, 'edit_user');
    
    // Non-admin users can only change their own password
    if (!isAdmin && targetUserId !== currentUserId) {
      return ERROR.json('AUTH_UNAUTHORIZED', {
        message: 'You can only change your own password',
      });
    }

    // Verify old password for the target user
    const targetUserIdentifier = user_id || user.email || user.phone_number;
    const authUser = await authenticateUser(targetUserIdentifier, old_password);
    if (!authUser) {
      return ERROR.json('AUTH_PASSWORD_INVALID_OLD', { user_id: targetUserId });
    }

    const success = await updateUserPassword(targetUserId, confirm_password);

    if (!success) {
      return ERROR.json('AUTH_PASSWORD_UPDATE_FAILED', { user_id: targetUserId });
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag) - password changed
    await invalidateAllUserRelatedCache(targetUserId);

    return SUCCESS.json('Password updated successfully', {
      message: 'Password updated successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in change_password', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'CHANGE_PASSWORD',
      },
    });
    return ERROR.json('AUTH_PASSWORD_UPDATE_FAILED', {}, error);
  }
}

