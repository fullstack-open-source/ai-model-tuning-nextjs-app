/**
 * Profile Helper Functions
 * Database queries and utilities for profile management
 */

import { prisma } from '@lib/db/prisma';
import { logger } from '@lib/logger/logger';
import { serializeUserData } from './helpers';

/**
 * Get user by user_id
 */
export async function getUserByUserId(userId: string) {
  try {
    if (!userId) {
      throw new Error('user_id is required');
    }

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      logger.warning(`User not found with user_id: ${userId}`, {
        module: 'Auth',
        extraData: { userId },
      });
      return null;
    }

    return {
      ...user,
      user_id: String(user.user_id),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database error in get_user_by_user_id', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    throw error;
  }
}

/**
 * Serialize data (convert dates, handle nested objects)
 * Excludes password field for security
 */
export function serializeData(data: any): any {
  function convertDatetime(obj: any): any {
    if (obj instanceof Date) {
      return obj.toISOString();
    } else if (Array.isArray(obj)) {
      return obj.map(convertDatetime);
    } else if (obj && typeof obj === 'object' && obj.constructor === Object) {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip password field - never send password to frontend
        if (key === 'password') {
          continue;
        }
        converted[key] = convertDatetime(value);
      }
      return converted;
    }
    return obj;
  }

  // Remove password from top level if present
  const sanitized = { ...data };
  if ('password' in sanitized) {
    delete sanitized.password;
  }

  return convertDatetime(sanitized);
}

