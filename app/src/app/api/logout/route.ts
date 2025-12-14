import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import jwt from 'jsonwebtoken';
import { authConfig } from '@lib/config/env';
import {
  blacklistAccessTokenByJti,
  revokeAllUserRefreshTokens,
  blacklistAllUserSessions,
} from '@lib/authenticate/session-manager';
import { invalidateUserPermissionsCache } from '@lib/cache/invalidation';
import { activityLogService } from '@services/ActivityLogService';

const SECRET_KEY = authConfig.jwtSecretKey || authConfig.jwtSecret;

/**
 * Logout
 * POST /api/logout
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    // Logout doesn't require specific permission, just authentication
    // But we keep the check for consistency - any authenticated user can logout

    const userId = String(user.uid || user.user_id);

    // Initialize revocation statuses
    let accessTokenRevoked = false;
    let refreshTokensRevoked = false;
    let sessionsRevoked = false;
    let tokensRevoked = false;

    try {
      // Extract token from request header
      const authHeader = req.headers.get('authorization') || '';
      let token: string | null = null;
      let tokenJti: string | null = null;

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '').trim();
      } else {
        // Try X-Session-Token header as fallback
        token = req.headers.get('x-session-token') || '';
      }

      // Decode token to get JTI (for logout, we need to decode even expired tokens)
      if (token) {
        try {
          if (!SECRET_KEY) {
            throw new Error('JWT_SECRET_KEY not set in environment');
          }

          // Try to decode with audience first, without expiration check
          interface JwtPayload {
            jti?: string;
            [key: string]: unknown;
          }
          let payload: JwtPayload | null = null;
          try {
            payload = jwt.decode(token, {
              complete: false,
            }) as JwtPayload | null;
            tokenJti = payload?.jti || null;
          } catch {
            tokenJti = null;
            logger.warning(`Could not decode token for user: ${userId}`, {
              module: 'Auth',
              extraData: { userId },
            });
          }

          // Blacklist access token by JTI if available
          if (tokenJti) {
            accessTokenRevoked = await blacklistAccessTokenByJti(tokenJti, userId);
          }
        } catch (tokenError: unknown) {
          const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
          logger.warning(`Error processing token for logout: ${errorMessage}`, {
            module: 'Auth',
            extraData: { userId },
          });
        }
      }

      // Revoke all refresh tokens for this user
      refreshTokensRevoked = await revokeAllUserRefreshTokens(userId);
      if (!refreshTokensRevoked) {
        logger.warning(`Failed to revoke refresh tokens for user: ${userId}`, {
          module: 'Auth',
          extraData: { userId },
        });
      }

      // Revoke all sessions for this user (complete logout from all devices)
      const sessionsRevokedCount = await blacklistAllUserSessions(userId);
      sessionsRevoked = sessionsRevokedCount > 0;
      if (!sessionsRevoked) {
        logger.warning(`Failed to revoke sessions for user: ${userId}`, {
          module: 'Auth',
          extraData: { userId },
        });
      }

      // Determine overall tokens_revoked status
      tokensRevoked = accessTokenRevoked && refreshTokensRevoked && sessionsRevoked;

      // Clear user permissions cache on logout
      await invalidateUserPermissionsCache(userId);

      // Log logout activity
      await activityLogService.logLogout(
        userId,
        { headers: req.headers, url: req.url, method: 'POST' }
      );

      // Build response message
      let logoutMessage: string;
      if (accessTokenRevoked && refreshTokensRevoked && sessionsRevoked) {
        logoutMessage = 'Logged out successfully. All tokens and sessions have been revoked.';
      } else {
        logoutMessage = 'Logged out successfully. Some tokens may still be active.';
      }

      // Build response data
      const responseData = {
        message: 'Logged out successfully',
        access_token_revoked: accessTokenRevoked,
        refresh_tokens_revoked: refreshTokensRevoked,
        sessions_revoked: sessionsRevoked,
        tokens_revoked: tokensRevoked,
      };

      return SUCCESS.json(logoutMessage, responseData);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in logout', {
        module: 'Auth',
        extraData: {
          error: errorMessage,
          userId,
          label: 'LOGOUT',
        },
      });
      return ERROR.json('AUTH_LOGOUT_FAILED', { user_id: userId }, error);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in logout', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'LOGOUT',
      },
    });
    return ERROR.json('AUTH_LOGOUT_FAILED', {}, error);
  }
}

