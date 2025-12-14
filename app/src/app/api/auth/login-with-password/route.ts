import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { activityLogService } from '@services/ActivityLogService';
import {
  authenticateUserWithData,
  extractOrigin,
  serializeUserData,
  trackLoginSession,
} from '@lib/authenticate/helpers';

/**
 * Login with Password
 * POST /api/auth/login-with-password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = body.username || body.user_name;
    const password = body.password;

    if (!username || !password) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'Missing required parameters: username and password',
      });
    }

    const origin = extractOrigin(req);
    const authResult = await authenticateUserWithData(username, password, origin, req);

    if (!authResult) {
      // Log failed login attempt
      await activityLogService.logLogin(
        null, // No user_id for failed login
        false,
        { username, reason: 'Invalid credentials' },
        { headers: req.headers, url: req.url, method: 'POST' }
      );
      return ERROR.json('AUTH_INVALID_CREDENTIALS', { username });
    }

    // Track login session and history
    await trackLoginSession(authResult.user.user_id, authResult.session_id, req);

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag) - last_sign_in_at updated
    await invalidateAllUserRelatedCache(authResult.user.user_id);

    // Log successful login
    await activityLogService.logLogin(
      authResult.user.user_id,
      true,
      { username, email: authResult.user.email },
      { headers: req.headers, url: req.url, method: 'POST' }
    );

    // Serialize user data
    const userDataSerialized = serializeUserData(authResult.user);

    // Fetch user's groups and permissions to include in response
    // This ensures frontend has immediate access to permissions after login
    const { getUserGroups } = await import('@lib/middleware/permissions');
    const { permissionResolverService } = await import('@services/PermissionService');
    const userGroups = await getUserGroups(authResult.user.user_id);
    const userPermissions = await permissionResolverService.getUserPermissions(authResult.user.user_id);

    return SUCCESS.json('Login successful', {
      access_token: authResult.access_token,
      refresh_token: authResult.refresh_token,
      session_token: authResult.session_token,
      session_id: authResult.session_id,
      token_type: 'bearer',
      user: userDataSerialized,
      groups: userGroups,
      permissions: userPermissions,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in login_with_password', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'LOGIN',
      },
    });
    return ERROR.json('AUTH_PROCESSING_ERROR', {}, error);
  }
}

