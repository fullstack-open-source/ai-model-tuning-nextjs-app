import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { verifyOtp, isMasterOtp } from '@lib/authenticate/otp-cache';
import {
  getUserByEmailOrPhone,
  validateEmail,
  validatePhone,
  generateAllTokens,
  extractOrigin,
  serializeUserData,
  updateUserVerificationStatus,
  updateLastSignIn,
  trackLoginSession,
} from '@lib/authenticate/helpers';
import {
  clearUserBlacklist,
  clearUserRefreshTokenBlacklist,
} from '@lib/authenticate/session-manager';

/**
 * Login with OTP
 * POST /api/auth/login-with-otp
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, channel, otp } = body;

    // Validation
    if (!user_id || !channel || !otp) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'user_id, channel, and otp are required',
      });
    }

    const userIdClean = user_id.trim();
    if (!validateEmail(userIdClean) && !validatePhone(userIdClean)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        user_id: userIdClean,
        message: 'Invalid email or phone number format',
      });
    }

    const user = await getUserByEmailOrPhone(userIdClean);
    if (!user) {
      return ERROR.json('USER_NOT_FOUND', { user_id: userIdClean });
    }

    if (!user.is_active || !user.is_verified) {
      return ERROR.json('AUTH_INVALID_CREDENTIALS', {
        user_id: userIdClean,
        message: 'User account is not active or verified',
      });
    }

    // Check if master OTP is used (for verification only, not assignment)
    const isMasterOtpUsed = isMasterOtp(otp);
    
    // Verify OTP (delete after verify for login, unless master OTP)
    const isValid = await verifyOtp(userIdClean, otp, !isMasterOtpUsed);
    if (!isValid && !isMasterOtpUsed) {
      return ERROR.json('AUTH_OTP_INVALID', { user_id: userIdClean, channel });
    }
    
    // Note: We don't assign groups during login - just verify OTP
    // User's existing groups/permissions will be checked after login
    // Master OTP during signup assigns super_admin, but during login it just verifies access

    const origin = extractOrigin(req);

    // Update user verification status based on channel
    if (channel) {
      await updateUserVerificationStatus(user.user_id, channel);
    }

    // Generate tokens first to get session_id
    const tokens = generateAllTokens(user, origin, req);

    // Track login session and history
    await trackLoginSession(user.user_id, tokens.session_id, req);

    // Update last sign in
    await updateLastSignIn(user.user_id);

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag) - user data updated
    await invalidateAllUserRelatedCache(user.user_id);

    // Clear user-level blacklist entries to allow new sessions after logout
    try {
      await clearUserBlacklist(String(user.user_id));
      await clearUserRefreshTokenBlacklist(String(user.user_id));
    } catch (clearError: unknown) {
      const errorMessage = clearError instanceof Error ? clearError.message : 'Unknown error';
      logger.warning(`Failed to clear user blacklist (non-blocking): ${errorMessage}`, {
        module: 'Auth',
        extraData: { userId: user.user_id },
      });
    }

    // Serialize user data
    const userDataSerialized = serializeUserData(user);

    // Fetch user's groups and permissions to include in response
    // This ensures frontend has immediate access to permissions after login
    const { getUserGroups } = await import('@lib/middleware/permissions');
    const { permissionResolverService } = await import('@services/PermissionService');
    const userGroups = await getUserGroups(user.user_id);
    const userPermissions = await permissionResolverService.getUserPermissions(user.user_id);

    return SUCCESS.json('Login successful', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      session_token: tokens.session_token,
      session_id: tokens.session_id,
      token_type: 'bearer',
      user: userDataSerialized,
      groups: userGroups,
      permissions: userPermissions,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in login_with_otp', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'LOGIN_OTP',
      },
    });
    return ERROR.json('AUTH_PROCESSING_ERROR', {}, error);
  }
}

