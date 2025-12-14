/**
 * Session Manager - Handles token blacklisting for stateless authentication
 * Multi-token session management with access_token, refresh_token, session_token, and session_id
 * Uses cache (Redis or in-memory) for blacklisting instead of database storage
 */

import crypto from 'crypto';
import { logger } from '@lib/logger/logger';
import { cache } from '@lib/cache/cache';
import { authConfig } from '@lib/config/env';

// Token expiration times (in minutes)
export const ACCESS_TOKEN_EXPIRY = authConfig.accessTokenExpiryMinutes || 60; // 1 hour
export const SESSION_TOKEN_EXPIRY = authConfig.sessionTokenExpiryMinutes || 10080; // 7 days
export const REFRESH_TOKEN_EXPIRY = authConfig.refreshTokenExpiryMinutes || 43200; // 30 days

/**
 * Create a hash of a token for blacklisting
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Add a token to the blacklist
 */
export async function blacklistToken(
  token: string,
  tokenType: 'access' | 'refresh' | 'session' = 'access',
  expiresInMinutes: number | null = null
): Promise<boolean> {
  try {
    const tokenHash = hashToken(token);
    const blacklistKey = `blacklist:${tokenType}:${tokenHash}`;

    // Set expiration based on token type if not provided
    if (expiresInMinutes === null) {
      if (tokenType === 'access') {
        expiresInMinutes = ACCESS_TOKEN_EXPIRY;
      } else if (tokenType === 'session') {
        expiresInMinutes = SESSION_TOKEN_EXPIRY;
      } else {
        // refresh
        expiresInMinutes = REFRESH_TOKEN_EXPIRY;
      }
    }

    // Store in cache with TTL (convert minutes to seconds)
    const ttlSeconds = expiresInMinutes * 60;
    await cache.set(blacklistKey, '1', ttlSeconds);

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error blacklisting token', {
      module: 'Auth',
      extraData: { error: errorMessage, tokenType },
    });
    return false;
  }
}

/**
 * Check if a token is blacklisted
 */
export async function isTokenBlacklisted(
  token: string,
  tokenType: 'access' | 'refresh' | 'session' = 'access'
): Promise<boolean> {
  try {
    const tokenHash = hashToken(token);
    const blacklistKey = `blacklist:${tokenType}:${tokenHash}`;

    const result = await cache.get<string>(blacklistKey);
    return result !== null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking token blacklist', {
      module: 'Auth',
      extraData: { error: errorMessage, tokenType },
    });
    // On error, assume not blacklisted to avoid blocking valid requests
    return false;
  }
}

/**
 * Blacklist a session by session_id
 */
export async function blacklistSession(
  sessionId: string,
  expiresInMinutes: number | null = null
): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:session:${sessionId}`;

    // Default to refresh token expiry (longest)
    if (expiresInMinutes === null) {
      expiresInMinutes = REFRESH_TOKEN_EXPIRY;
    }

    const ttlSeconds = expiresInMinutes * 60;
    await cache.set(blacklistKey, '1', ttlSeconds);

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error blacklisting session', {
      module: 'Auth',
      extraData: { error: errorMessage, sessionId },
    });
    return false;
  }
}

/**
 * Check if a session is blacklisted
 */
export async function isSessionBlacklisted(sessionId: string): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:session:${sessionId}`;
    const result = await cache.get<string>(blacklistKey);
    return result !== null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking session blacklist', {
      module: 'Auth',
      extraData: { error: errorMessage, sessionId },
    });
    // On error, assume not blacklisted to avoid blocking valid requests
    return false;
  }
}

/**
 * Blacklist all sessions for a user
 */
export async function blacklistAllUserSessions(
  userId: string,
  expiresInMinutes: number | null = null
): Promise<number> {
  try {
    const blacklistKey = `blacklist:user:${userId}`;

    if (expiresInMinutes === null) {
      expiresInMinutes = REFRESH_TOKEN_EXPIRY;
    }

    const ttlSeconds = expiresInMinutes * 60;
    await cache.set(blacklistKey, '1', ttlSeconds);

    return 1;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error blacklisting user sessions', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return 0;
  }
}

/**
 * Check if all sessions for a user are blacklisted
 */
export async function isUserBlacklisted(userId: string): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:user:${userId}`;
    const result = await cache.get<string>(blacklistKey);
    return result !== null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking user blacklist', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return false;
  }
}

/**
 * Clear/remove user-level blacklist entry
 */
export async function clearUserBlacklist(userId: string): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:user:${userId}`;
    await cache.delete(blacklistKey);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error clearing user blacklist', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return false;
  }
}

/**
 * Clear/remove user-level refresh token blacklist entry
 */
export async function clearUserRefreshTokenBlacklist(userId: string): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:user_refresh_revoke:${userId}`;
    await cache.delete(blacklistKey);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error clearing user refresh token blacklist', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return false;
  }
}

/**
 * Blacklist an access token by its JTI (JWT ID)
 */
export async function blacklistAccessTokenByJti(
  tokenJti: string,
  userId: string,
  expiresInSeconds: number | null = null
): Promise<boolean> {
  try {
    if (!tokenJti) {
      logger.warning(`No JTI provided for blacklisting access token for user ${userId}`, {
        module: 'Auth',
        extraData: { userId },
      });
      return false;
    }

    const blacklistKey = `blacklist:access:jti:${tokenJti}`;

    // Default to access token expiry (convert minutes to seconds)
    if (expiresInSeconds === null) {
      expiresInSeconds = ACCESS_TOKEN_EXPIRY * 60;
    }

    await cache.set(blacklistKey, '1', expiresInSeconds);

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error blacklisting access token by JTI', {
      module: 'Auth',
      extraData: { error: errorMessage, tokenJti, userId },
    });
    return false;
  }
}

/**
 * Check if an access token is blacklisted by its JTI
 */
export async function isAccessTokenBlacklistedByJti(tokenJti: string): Promise<boolean> {
  try {
    if (!tokenJti) {
      return false;
    }

    const blacklistKey = `blacklist:access:jti:${tokenJti}`;
    const result = await cache.get<string>(blacklistKey);
    return result !== null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking access token blacklist by JTI', {
      module: 'Auth',
      extraData: { error: errorMessage, tokenJti },
    });
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:refresh:user:${userId}`;

    // Use refresh token expiry (longest)
    const ttlSeconds = REFRESH_TOKEN_EXPIRY * 60;
    await cache.set(blacklistKey, '1', ttlSeconds);

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error revoking all refresh tokens for user', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return false;
  }
}

/**
 * Check if all refresh tokens for a user have been revoked
 */
export async function isUserRefreshTokenRevoked(userId: string): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:refresh:user:${userId}`;
    const result = await cache.get<string>(blacklistKey);
    return result !== null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking user refresh token revocation', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return false;
  }
}

