import { AuthenticatedUser } from './auth';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { prisma } from '@lib/db/prisma';
import { permissionResolverService } from '@services/PermissionService';
import { invalidateUserPermissionsCache } from '@lib/cache/invalidation';

/**
 * Check if user has permission through assigned groups
 * 
 * Uses the PermissionResolverService for optimized database queries
 */
export async function userHasPermission(userId: string, permissionCodename: string): Promise<boolean> {
  try {
    // Use the new PermissionResolverService for consistency
    return await permissionResolverService.hasPermission(userId, permissionCodename);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking user permission', {
      module: 'Permissions',
      extraData: { error: errorMessage, userId, permissionCodename },
    });
    return false;
  }
}

interface UserGroupResult {
  group_id: string;
  name: string;
  codename: string;
  description: string | null;
  is_system: boolean | null;
  is_active: boolean | null;
  assigned_at: Date | null;
  assigned_by_user_id: string | null;
}

/**
 * Get user groups from user_group table
 */
export async function getUserGroups(userId: string): Promise<UserGroupResult[]> {
  try {
    const userGroups = await prisma.userGroup.findMany({
      where: {
        user_id: userId,
        group: {
          is_active: true,
        },
      },
      include: {
        group: true,
      },
      orderBy: {
        group: {
          name: 'asc',
        },
      },
    });

    return userGroups.map((ug) => ({
      group_id: ug.group.group_id,
      name: ug.group.name,
      codename: ug.group.codename || ug.group.name,
      description: ug.group.description,
      is_system: ug.group.is_system,
      is_active: ug.group.is_active,
      assigned_at: ug.created_at,
      assigned_by_user_id: null,
    }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting user groups', {
      module: 'Permissions',
      extraData: { error: errorMessage, userId },
    });
    return [];
  }
}

/**
 * Get user permissions from all assigned groups
 * Returns full permission objects with metadata
 * 
 * For just permission codenames (strings), use permissionService.getUserPermissions() instead
 */
export async function getUserPermissions(userId: string): Promise<Array<{
  permission_id: string;
  name: string;
  codename: string;
  description: string | null;
  category: string | null;
}>> {
  try {
    const userGroups = await prisma.userGroup.findMany({
      where: {
        user_id: userId,
        group: {
          is_active: true,
        },
      },
      include: {
        group: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Extract unique permissions
    const permissionMap = new Map<string, {
      permission_id: string;
      name: string;
      codename: string;
      description: string | null;
      category: string | null;
    }>();

    userGroups.forEach((ug) => {
      ug.group.permissions.forEach((gp) => {
        const perm = gp.permission;
        if (perm && !permissionMap.has(perm.permission_id)) {
          permissionMap.set(perm.permission_id, {
            permission_id: perm.permission_id,
            name: perm.name,
            codename: perm.codename || perm.name,
            description: perm.description,
            category: perm.module,
          });
        }
      });
    });

    // Sort by category and name
    return Array.from(permissionMap.values()).sort((a, b) => {
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '');
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting user permissions', {
      module: 'Permissions',
      extraData: { error: errorMessage, userId },
    });
    return [];
  }
}

/**
 * Assign groups to user
 */
export async function assignGroupsToUser(
  userId: string,
  groupCodenames: string[],
  assignedByUserId: string | null = null
): Promise<boolean> {
  try {
    if (!groupCodenames || !Array.isArray(groupCodenames)) {
      throw new Error('groupCodenames must be an array');
    }

    // Get group IDs from codenames
    let groups = await prisma.group.findMany({
      where: {
        codename: { in: groupCodenames },
        is_active: true,
      },
      select: { group_id: true, codename: true },
    });

    // Auto-create missing groups if they are system groups
    const foundCodenames = groups.map((g) => g.codename);
    const missing = groupCodenames.filter((c) => !foundCodenames.includes(c));
    
    if (missing.length > 0) {
      // Define default system groups
      const defaultGroups: Record<string, { name: string; description: string }> = {
        'user': { name: 'User', description: 'Standard user with basic permissions' },
        'super_admin': { name: 'Super Admin', description: 'Full system access with all permissions' },
        'admin': { name: 'Sub Admin', description: 'Administrative access with most permissions' },
        'agent': { name: 'Agent', description: 'Support agent with user creation and profile management' },
      };

      // Create missing groups that are in the default list
      for (const codename of missing) {
        if (defaultGroups[codename]) {
          try {
            const newGroup = await prisma.group.create({
              data: {
                name: defaultGroups[codename].name,
                codename: codename,
                description: defaultGroups[codename].description,
                is_system: true,
                is_active: true,
              },
              select: { group_id: true, codename: true },
            });
            groups.push(newGroup);
            logger.info(`Auto-created missing group: ${codename}`, {
              module: 'Permissions',
              extraData: { codename, group_id: newGroup.group_id },
            });
          } catch (error) {
            logger.error(`Failed to auto-create group: ${codename}`, {
              module: 'Permissions',
              extraData: { error: error instanceof Error ? error.message : 'Unknown error' },
            });
          }
        }
      }

      // Check again for any remaining missing groups
      const stillMissing = groupCodenames.filter((c) => !groups.map((g) => g.codename).includes(c));
      if (stillMissing.length > 0) {
        throw new Error(`Groups not found: ${stillMissing.join(', ')}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      // Remove existing groups
      await tx.userGroup.deleteMany({
        where: { user_id: userId },
      });

      // Add new groups
      if (groups.length > 0) {
        await tx.userGroup.createMany({
          data: groups.map((g) => ({
            user_id: userId,
            group_id: g.group_id,
            assigned_by_user_id: assignedByUserId || null,
          })),
          skipDuplicates: true,
        });
      }
    });

    // Invalidate user permissions cache after group assignment
    await invalidateUserPermissionsCache(userId);

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error assigning groups to user', {
      module: 'Permissions',
      extraData: { error: errorMessage, userId, groupCodenames },
    });
    throw error;
  }
}

/**
 * Check if user has required permission(s)
 */
export async function checkPermission(
  user: AuthenticatedUser,
  requiredPermissions: string | string[],
  requireAll: boolean = false
): Promise<void> {
  const userId = user.uid || user.user_id;
  
  if (!userId) {
      interface AuthError extends Error {
        statusCode?: number;
        details?: unknown;
      }
      const error = new Error('User not authenticated') as AuthError;
      error.statusCode = 403;
      error.details = ERROR.fromMap('FORBIDDEN', { message: 'User not authenticated' });
      throw error;
  }

  // Superuser bypass - check if user has super_admin group
  try {
    const userGroups = await getUserGroups(String(userId));
    const isSuperuser = userGroups.some((g) => g.codename === 'super_admin');
    if (isSuperuser) {
      return; // Superuser has all permissions
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warning('Error checking superuser status', {
      module: 'Permissions',
      extraData: { error: errorMessage },
    });
  }

  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  if (requireAll) {
    // User must have ALL permissions
    for (const permission of permissions) {
      const hasPermission = await userHasPermission(String(userId), permission);
      if (!hasPermission) {
        interface PermissionError extends Error {
          statusCode?: number;
          details?: unknown;
        }
        const error = new Error(`Missing required permission: ${permission}`) as PermissionError;
        error.statusCode = 403;
        error.details = ERROR.fromMap('FORBIDDEN', {
          message: `Missing required permission: ${permission}`,
          permission,
        });
        throw error;
      }
    }
  } else {
    // User needs ANY permission
    let hasAnyPermission = false;
    for (const permission of permissions) {
      if (await userHasPermission(String(userId), permission)) {
        hasAnyPermission = true;
        break;
      }
    }

    if (!hasAnyPermission) {
      interface PermissionError extends Error {
        statusCode?: number;
        details?: unknown;
      }
      const error = new Error(`Missing required permission. Required one of: ${permissions.join(', ')}`) as PermissionError;
      error.statusCode = 403;
      error.details = ERROR.fromMap('FORBIDDEN', {
        message: `Missing required permission. Required one of: ${permissions.join(', ')}`,
        required_permissions: permissions,
      });
      throw error;
    }
  }
}

