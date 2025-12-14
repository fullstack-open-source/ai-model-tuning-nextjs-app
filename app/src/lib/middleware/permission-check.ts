/**
 * Permission Check Helper
 * Provides user-friendly permission checking with clear error messages
 */

import { AuthenticatedUser } from './auth';
import { ERROR } from '@lib/response/response';
import { checkPermission, userHasPermission } from './permissions';
import { logger } from '@lib/logger/logger';

/**
 * Check permission with user-friendly error handling
 * Catches permission errors and returns user-friendly error response
 * Use this in API routes to get proper error messages
 */
interface PermissionError extends Error {
  statusCode?: number;
  details?: unknown;
}

export async function requirePermission(
  user: AuthenticatedUser,
  requiredPermissions: string | string[],
  requireAll: boolean = false
): Promise<void> {
  try {
    await checkPermission(user, requiredPermissions, requireAll);
  } catch (error: unknown) {
    // If it's a permission error, throw a user-friendly error
    const permError = error as PermissionError;
    if (permError.statusCode === 403 || permError.details) {
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      const permissionList = permissions.length === 1 
        ? permissions[0] 
        : requireAll 
          ? `all of: ${permissions.join(', ')}`
          : `one of: ${permissions.join(' or ')}`;
      
      const friendlyError = new Error(`You do not have access to this resource. Required permission: ${permissionList}`) as PermissionError;
      friendlyError.statusCode = 403;
      friendlyError.details = ERROR.fromMap('FORBIDDEN', {
        message: `You do not have access to this resource. Required permission: ${permissionList}`,
        required_permissions: permissions,
        friendly_message: 'Access Denied',
      });
      throw friendlyError;
    }
    
    // For other errors, rethrow as-is
    throw error;
  }
}

/**
 * Wrapper for permission check in API routes
 * Returns error response if permission check fails, otherwise returns null
 */
export async function checkPermissionOrReturnError(
  user: AuthenticatedUser,
  requiredPermissions: string | string[],
  requireAll: boolean = false
): Promise<Response | null> {
  try {
    await checkPermission(user, requiredPermissions, requireAll);
    return null; // Permission check passed
  } catch (error: unknown) {
    // If it's a permission error, return user-friendly error response
    const permError = error as PermissionError;
    if (permError.statusCode === 403 || permError.details) {
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      const permissionList = permissions.length === 1 
        ? permissions[0] 
        : requireAll 
          ? `all of: ${permissions.join(', ')}`
          : `one of: ${permissions.join(' or ')}`;
      
      return ERROR.json('FORBIDDEN', {
        message: `You do not have access to this resource. Required permission: ${permissionList}`,
        required_permissions: permissions,
      });
    }
    
    // For other errors, rethrow
    throw error;
  }
}

/**
 * Check if user has permission (returns boolean, doesn't throw)
 */
export async function hasPermission(
  user: AuthenticatedUser,
  permissionCodename: string
): Promise<boolean> {
  try {
    const userId = user.uid || user.user_id;
    if (!userId) {
      return false;
    }
    return await userHasPermission(String(userId), permissionCodename);
  } catch (error: unknown) {
    logger.error('Error checking permission', {
      module: 'PermissionCheck',
      extraData: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return false;
  }
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  user: AuthenticatedUser,
  permissionCodenames: string[]
): Promise<boolean> {
  try {
    const userId = user.uid || user.user_id;
    if (!userId) {
      return false;
    }
    
    for (const permission of permissionCodenames) {
      if (await userHasPermission(String(userId), permission)) {
        return true;
      }
    }
    return false;
  } catch (error: unknown) {
    logger.error('Error checking permissions', {
      module: 'PermissionCheck',
      extraData: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return false;
  }
}

/**
 * Check if user is admin (super_admin or admin group)
 */
export async function isAdmin(user: AuthenticatedUser): Promise<boolean> {
  try {
    const userId = user.uid || user.user_id;
    if (!userId) {
      return false;
    }
    
    const { getUserGroups } = await import('./permissions');
    const userGroups = await getUserGroups(String(userId));
    return userGroups.some((g) => g.codename === 'super_admin' || g.codename === 'admin');
  } catch (error: unknown) {
    logger.error('Error checking admin status', {
      module: 'PermissionCheck',
      extraData: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return false;
  }
}

/**
 * Check admin status and return error if not admin
 */
export async function checkAdminOrReturnError(
  user: AuthenticatedUser
): Promise<Response | null> {
  try {
    const adminStatus = await isAdmin(user);
    if (!adminStatus) {
      return ERROR.json('FORBIDDEN', {
        message: 'This resource requires admin access',
        friendly_message: 'Admin access required',
      });
    }
    return null; // Admin check passed
  } catch (error: unknown) {
    logger.error('Error checking admin status', {
      module: 'PermissionCheck',
      extraData: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return ERROR.json('INTERNAL_ERROR', {
      message: 'Error checking admin status',
    });
  }
}

