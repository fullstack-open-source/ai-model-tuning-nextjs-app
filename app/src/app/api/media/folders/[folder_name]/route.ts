import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';
import fs from 'fs/promises';
import path from 'path';

/**
 * Update folder name (rename)
 * PATCH /api/media/folders/[folder_name]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ folder_name: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'manage_media');
    if (permissionError) return permissionError;

    const { folder_name } = await params;
    const decodedFolderName = decodeURIComponent(folder_name);
    const body = await req.json();
    const newFolderName = body.name?.trim();

    if (!newFolderName) {
      return ERROR.json('FOLDER_NAME_REQUIRED', { message: 'New folder name is required' });
    }

    // Validate folder name
    if (!/^[a-zA-Z0-9_-]+$/.test(newFolderName)) {
      return ERROR.json('INVALID_FOLDER_NAME', {
        message: 'Folder name can only contain letters, numbers, hyphens, and underscores',
      });
    }

    if (decodedFolderName === newFolderName) {
      return ERROR.json('SAME_FOLDER_NAME', { message: 'New folder name is the same as current name' });
    }

    // Check if new folder name already exists
    const existingFolder = await prisma.media.findFirst({
      where: {
        folder: newFolderName,
      },
    });

    if (existingFolder) {
      return ERROR.json('FOLDER_EXISTS', { message: 'Folder name already exists' });
    }

    // Update all media files in this folder
    const updateResult = await prisma.media.updateMany({
      where: {
        folder: decodedFolderName,
      },
      data: {
        folder: newFolderName,
      },
    });

    // Try to rename physical folder if it exists
    const oldFolderPath = path.join(process.cwd(), 'public', 'uploads', decodedFolderName);
    const newFolderPath = path.join(process.cwd(), 'public', 'uploads', newFolderName);
    try {
      await fs.access(oldFolderPath);
      await fs.rename(oldFolderPath, newFolderPath);
      logger.info('Physical folder renamed', {
        module: 'Media',
        label: 'RENAME_FOLDER_PHYSICAL',
        extraData: { old_path: oldFolderPath, new_path: newFolderPath },
      });
    } catch (fsError) {
      // Ignore error - folder might not exist physically
      logger.warning('Could not rename physical folder (may not exist)', {
        module: 'Media',
        extraData: { error: fsError instanceof Error ? fsError.message : 'Unknown error' },
      });
    }

    logger.info('Folder renamed', {
      module: 'Media',
      label: 'RENAME_FOLDER',
      extraData: {
        old_name: decodedFolderName,
        new_name: newFolderName,
        files_updated: updateResult.count,
        user_id: user?.uid || user?.user_id,
      },
    });

    // Emit WebSocket event for real-time update
    try {
      const { emitFolderUpdated } = await import('@lib/websocket/emitter');
      emitFolderUpdated(decodedFolderName, newFolderName, user?.uid || user?.user_id);
    } catch (wsError) {
      logger.warning('Failed to emit folder updated WebSocket event', {
        module: 'Media',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
      });
    }

    return SUCCESS.json('Folder renamed successfully', {
      folder: {
        name: newFolderName,
        path: newFolderName,
        file_count: updateResult.count,
        total_size: 0, // Will be calculated on next folder list
        by_type: {},
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error renaming folder', {
      module: 'Media',
      label: 'RENAME_FOLDER_ERROR',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Delete folder
 * DELETE /api/media/folders/[folder_name]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ folder_name: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'manage_media');
    if (permissionError) return permissionError;

    const { folder_name } = await params;
    const decodedFolderName = decodeURIComponent(folder_name);

    // Check if folder has files
    const fileCount = await prisma.media.count({
      where: {
        folder: decodedFolderName,
      },
    });

    // Get folder paths
    const folderPath = path.join(process.cwd(), 'public', 'uploads', decodedFolderName);
    const defaultFolderPath = path.join(process.cwd(), 'public', 'uploads');

    if (fileCount > 0) {
      // Get all files in this folder to move them physically
      const filesToMove = await prisma.media.findMany({
        where: { folder: decodedFolderName },
        select: { media_id: true, filename: true, path: true },
      });

      // Ensure default 'uploads' folder exists
      try {
        await fs.mkdir(defaultFolderPath, { recursive: true });
      } catch {
        // Ignore if already exists
      }

      // Move physical files to uploads folder
      let filesMoved = 0;
      for (const file of filesToMove) {
        const oldFilePath = path.join(folderPath, file.filename);
        const newFilePath = path.join(defaultFolderPath, file.filename);
        
        try {
          await fs.access(oldFilePath);
          await fs.rename(oldFilePath, newFilePath);
          filesMoved++;
          
          // Update the storage path in database
          const newStoragePath = `uploads/uploads/${file.filename}`;
          await prisma.media.update({
            where: { media_id: file.media_id },
            data: { 
              folder: 'uploads',
              path: newStoragePath,
            },
          });
        } catch (moveError) {
          // File might not exist physically, just update database
          logger.warning('Could not move physical file', {
            module: 'Media',
            extraData: { 
              file: file.filename,
              error: moveError instanceof Error ? moveError.message : 'Unknown error',
            },
          });
          
          // Still update database record
          await prisma.media.update({
            where: { media_id: file.media_id },
            data: { folder: 'uploads' },
          });
        }
      }

      // Now try to delete the (hopefully empty) physical folder
      try {
        // Use rm with recursive to handle any remaining files
        await fs.rm(folderPath, { recursive: true, force: true });
        logger.info('Physical folder deleted after moving files', {
          module: 'Media',
          label: 'DELETE_FOLDER_PHYSICAL',
          extraData: { folder_path: folderPath },
        });
      } catch (rmError) {
        logger.warning('Could not delete physical folder after moving files', {
          module: 'Media',
          extraData: { 
            folder_path: folderPath,
            error: rmError instanceof Error ? rmError.message : 'Unknown error',
          },
        });
      }

      logger.info('Folder removed (files moved to uploads)', {
        module: 'Media',
        label: 'DELETE_FOLDER',
        extraData: {
          folder_name: decodedFolderName,
          files_moved: filesMoved,
          db_records_updated: filesToMove.length,
          user_id: user?.uid || user?.user_id,
        },
      });

      // Emit WebSocket event for real-time update
      try {
        const { emitFolderDeleted } = await import('@lib/websocket/emitter');
        emitFolderDeleted(decodedFolderName, user?.uid || user?.user_id);
      } catch (wsError) {
        logger.warning('Failed to emit folder deleted WebSocket event', {
          module: 'Media',
          extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
        });
      }

      return SUCCESS.json('Folder removed successfully. Files moved to uploads folder.', {
        files_moved: filesToMove.length,
      });
    }

    // Folder is empty in database, try to delete physical directory
    // Use recursive delete to handle any orphaned files that might still exist
    try {
      await fs.rm(folderPath, { recursive: true, force: true });
      logger.info('Physical folder deleted', {
        module: 'Media',
        label: 'DELETE_FOLDER_PHYSICAL',
        extraData: { folder_path: folderPath },
      });
    } catch (fsError) {
      // Ignore error - folder might not exist physically
      logger.warning('Could not delete physical folder (may not exist)', {
        module: 'Media',
        extraData: { folder_path: folderPath, error: fsError instanceof Error ? fsError.message : 'Unknown error' },
      });
    }

    logger.info('Empty folder removed', {
      module: 'Media',
      label: 'DELETE_FOLDER',
      extraData: {
        folder_name: decodedFolderName,
        user_id: user?.uid || user?.user_id,
      },
    });

    // Emit WebSocket event for empty folder deletion too
    try {
      const { emitFolderDeleted } = await import('@lib/websocket/emitter');
      emitFolderDeleted(decodedFolderName, user?.uid || user?.user_id);
    } catch (wsError) {
      logger.warning('Failed to emit folder deleted WebSocket event', {
        module: 'Media',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
      });
    }

    return SUCCESS.json('Folder removed successfully', null);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting folder', {
      module: 'Media',
      label: 'DELETE_FOLDER_ERROR',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

