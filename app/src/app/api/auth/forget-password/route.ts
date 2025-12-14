import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { verifyOtp } from '@lib/authenticate/otp-cache';
import {
  getUserByEmailOrPhone,
  validateEmail,
  validatePhone,
  updateUserPassword,
} from '@lib/authenticate/helpers';

/**
 * Forget Password (Reset Password with OTP)
 * POST /api/auth/forget-password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, otp, password, confirm_password } = body;

    if (!user_id || !otp || !password || !confirm_password) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'user_id, otp, password, and confirm_password are required',
      });
    }

    if (password !== confirm_password) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'password and confirm_password do not match',
      });
    }

    // Verify OTP
    const isValid = await verifyOtp(user_id, otp, true);
    if (!isValid) {
      return ERROR.json('AUTH_OTP_INVALID', { user_id });
    }

    const userIdClean = user_id.trim();
    if (!validatePhone(userIdClean) && !validateEmail(userIdClean)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', { user_id: userIdClean });
    }

    const user = await getUserByEmailOrPhone(userIdClean);
    if (!user) {
      return ERROR.json('USER_NOT_FOUND', { user_id: userIdClean });
    }

    const success = await updateUserPassword(String(user.user_id), confirm_password);
    if (!success) {
      return ERROR.json('AUTH_FORGOT_PASSWORD_FAILED', { user_id: userIdClean });
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag) - password changed
    await invalidateAllUserRelatedCache(String(user.user_id));

    return SUCCESS.json('Password updated successfully', {
      message: 'Password updated successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in forget_password', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'FORGET_PASSWORD',
      },
    });
    return ERROR.json('AUTH_FORGOT_PASSWORD_FAILED', {}, error);
  }
}

