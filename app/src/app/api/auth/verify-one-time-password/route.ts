import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { verifyOtp } from '@lib/authenticate/otp-cache';

/**
 * Verify One-Time Password
 * POST /api/auth/verify-one-time-password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, channel, otp } = body;

    // Validation
    if (!user_id) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', { message: 'user_id is required' });
    }

    if (!otp) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', { message: 'otp is required' });
    }

    // Verify OTP (don't delete after verify - keep for potential reuse)
    const isValid = await verifyOtp(user_id, otp, false);

    if (!isValid) {
      logger.warning('OTP verification failed', {
        module: 'Auth',
        extraData: { user_id, channel },
      });
      return ERROR.json('AUTH_OTP_INVALID', { user_id });
    }

    logger.info('OTP verified successfully', {
      module: 'Auth',
      extraData: { user_id, channel },
    });

    return SUCCESS.json('Verify Successfully', { user_id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in verify_one_time_password', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'VERIFY_OTP',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

