/**
 * Permissions Helper Functions
 * Database operations for permissions and groups
 */

import { prisma } from '@lib/db/prisma';
import { logger } from '@lib/logger/logger';

/**
 * Get group by ID
 */
export async function getGroupById(groupId: string) {
  try {
    const group = await prisma.group.findUnique({
      where: { group_id: groupId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!group) {
      return null;
    }

    return {
      group_id: group.group_id,
      name: group.name,
      codename: group.codename,
      description: group.description,
      is_system: group.is_system,
      is_active: group.is_active,
      permissions: group.permissions.map((gp) => ({
        permission_id: gp.permission.permission_id,
        name: gp.permission.name,
        codename: gp.permission.codename,
        description: gp.permission.description,
        category: gp.permission.module,
      })),
      created_at: group.created_at,
      last_updated: group.updated_at,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting group by ID', {
      module: 'Permissions',
      extraData: { error: errorMessage, groupId },
    });
    throw error;
  }
}

/**
 * Update group
 */
export async function updateGroup(groupId: string, groupData: any) {
  try {
    const { name, codename, description, is_active } = groupData;

    await prisma.group.update({
      where: { group_id: groupId },
      data: {
        ...(name !== undefined && { name }),
        ...(codename !== undefined && { codename }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    return await getGroupById(groupId);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating group', {
      module: 'Permissions',
      extraData: { error: errorMessage, groupId },
    });
    throw error;
  }
}

/**
 * Delete group
 */
export async function deleteGroup(groupId: string): Promise<boolean> {
  try {
    // Check if group is a system group
    const group = await prisma.group.findUnique({
      where: { group_id: groupId },
      select: { is_system: true },
    });

    if (group?.is_system) {
      throw new Error('System groups cannot be deleted');
    }

    await prisma.group.delete({
      where: { group_id: groupId },
    });

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting group', {
      module: 'Permissions',
      extraData: { error: errorMessage, groupId },
    });
    throw error;
  }
}

/**
 * Assign permissions to group
 */
export async function assignPermissionsToGroup(groupId: string, permissionIds: string[]): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx: any) => {
      // Remove existing permissions
      await tx.groupPermission.deleteMany({
        where: { group_id: groupId },
      });

      // Add new permissions
      if (permissionIds && permissionIds.length > 0) {
        await tx.groupPermission.createMany({
          data: permissionIds.map((permissionId) => ({
            group_id: groupId,
            permission_id: permissionId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error assigning permissions to group', {
      module: 'Permissions',
      extraData: { error: errorMessage, groupId, permissionIds },
    });
    throw error;
  }
}
