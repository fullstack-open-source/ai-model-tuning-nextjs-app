import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { prisma } from '@lib/db/prisma';
import { buildUserProfilePayload, trackLoginSession, generateAllTokens, extractOrigin, serializeUserData } from '@lib/authenticate/helpers';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';

/**
 * Verify 2FA Code
 * POST /api/auth/verify-2fa
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, session_token } = body;

    if (!code || code.length !== 6) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'Verification code is required and must be 6 digits',
      });
    }

    // Get user from session token or temporary session
    let user;
    if (session_token) {
      // Verify session token and get user
      const { user: sessionUser } = await validateRequest(req);
      if (!sessionUser) {
        return ERROR.json('AUTH_INVALID_TOKEN', {
          message: 'Invalid session token',
        });
      }
      user = await prisma.user.findUnique({
        where: { user_id: sessionUser.uid || sessionUser.user_id },
      });
    } else {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'Session token is required',
      });
    }

    if (!user) {
      return ERROR.json('AUTH_USER_NOT_FOUND', {
        message: 'User not found',
      });
    }

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return ERROR.json('AUTH_2FA_NOT_ENABLED', {
        message: 'Two-factor authentication is not enabled for this account',
      });
    }

    // In production, verify the code against the secret using a proper 2FA library
    // For now, we'll use a simple verification (check against verification_code)
    // In a real implementation, you'd use speakeasy or similar to verify TOTP codes
    const isValid = user.verification_code === code;

    if (!isValid) {
      return ERROR.json('AUTH_INVALID_CODE', {
        message: 'Invalid verification code',
      });
    }

    // Clear verification code after successful verification
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: { verification_code: null },
    });

    // Generate tokens
    const origin = extractOrigin(req);
    const tokens = generateAllTokens(user, origin, req);

    // Track login session and history
    await trackLoginSession(user.user_id, tokens.session_id, req);

    // Invalidate cache
    await invalidateAllUserRelatedCache(user.user_id);

    // Serialize user data
    const userDataSerialized = serializeUserData(user);

    return SUCCESS.json('2FA verification successful', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      session_token: tokens.session_token,
      session_id: tokens.session_id,
      token_type: 'bearer',
      user: userDataSerialized,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error verifying 2FA', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'VERIFY_2FA',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

