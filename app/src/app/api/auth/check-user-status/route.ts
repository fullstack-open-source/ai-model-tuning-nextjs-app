import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { getUserByEmailOrPhone, validateEmail, validatePhone } from '@lib/authenticate/helpers';

/**
 * Check User Status
 * POST /api/auth/check-user-status
 * Returns whether user exists and if they have a password set
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'user_id is required',
      });
    }

    const userIdClean = user_id.trim();
    if (!validateEmail(userIdClean) && !validatePhone(userIdClean)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'Invalid email or phone number format',
      });
    }

    const user = await getUserByEmailOrPhone(userIdClean);

    if (!user) {
      // User doesn't exist
      return SUCCESS.json('User status checked', {
        exists: false,
        has_password: false,
        user_id: userIdClean,
      });
    }

    // Check if user has a password set
    // If password is 6 digits or less, it's likely an OTP (temporary password)
    const hasPassword = !!user.password && user.password.length > 6;

    return SUCCESS.json('User status checked', {
      exists: true,
      has_password: hasPassword,
      is_active: user.is_active || false,
      is_verified: user.is_verified || false,
      user_id: userIdClean,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking user status', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'CHECK_USER_STATUS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

