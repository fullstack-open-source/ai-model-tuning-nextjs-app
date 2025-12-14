import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';
import fs from 'fs/promises';
import path from 'path';

/**
 * Get all folders with statistics
 * GET /api/media/folders
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_media');
    if (permissionError) return permissionError;

    // Get all unique folders from database
    const foldersData = await prisma.media.groupBy({
      by: ['folder'],
      _count: {
        folder: true,
      },
      _sum: {
        size: true,
      },
    });

    // Track which folders we've processed
    const processedFolders = new Set<string>();

    // Get file type breakdown for each folder
    const folders: Array<{
      name: string;
      path: string;
      file_count: number;
      total_size: number;
      by_type: Record<string, { count: number; size: number }>;
    }> = [];

    for (const folderData of foldersData) {
      const folderName = folderData.folder || 'uploads';
      processedFolders.add(folderName);
      
      // Get file type breakdown for this folder
      const byTypeData = await prisma.media.groupBy({
        by: ['mime_type'],
        where: {
          folder: folderName,
        },
        _count: {
          mime_type: true,
        },
        _sum: {
          size: true,
        },
      });

      const byType: Record<string, { count: number; size: number }> = {};
      byTypeData.forEach((item: { mime_type: string | null; _count: { mime_type: number }; _sum: { size: number | null } }) => {
        if (item.mime_type) {
          // Map mime_type to file type category
          const fileType = item.mime_type.startsWith('image/') ? 'image'
            : item.mime_type.startsWith('video/') ? 'video'
            : item.mime_type.startsWith('audio/') ? 'audio'
            : item.mime_type.includes('pdf') || item.mime_type.includes('document') || item.mime_type.includes('text') ? 'document'
            : item.mime_type.includes('zip') || item.mime_type.includes('rar') || item.mime_type.includes('tar') ? 'archive'
            : 'other';
          
          if (!byType[fileType]) {
            byType[fileType] = { count: 0, size: 0 };
          }
          byType[fileType].count += item._count.mime_type;
          byType[fileType].size += Number(item._sum.size || 0);
        }
      });

      folders.push({
        name: folderName,
        path: folderName,
        file_count: folderData._count.folder,
        total_size: Number(folderData._sum.size || 0),
        by_type: byType,
      });
    }

    // Scan physical folders in public/uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      // Ensure uploads directory exists
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const dirContents = await fs.readdir(uploadsDir, { withFileTypes: true });
      for (const item of dirContents) {
        if (item.isDirectory() && !processedFolders.has(item.name)) {
          // This is a physical folder not in database yet
          processedFolders.add(item.name);
          folders.push({
            name: item.name,
            path: item.name,
            file_count: 0,
            total_size: 0,
            by_type: {},
          });
        }
      }
    } catch (fsError) {
      // Log but don't fail - database folders are still valid
      logger.warning('Could not scan physical folders', {
        module: 'Media',
        label: 'GET_FOLDERS_SCAN',
        extraData: { error: fsError instanceof Error ? fsError.message : 'Unknown error' },
      });
    }

    // Always include 'uploads' folder even if empty
    if (!processedFolders.has('uploads')) {
      folders.push({
        name: 'uploads',
        path: 'uploads',
        file_count: 0,
        total_size: 0,
        by_type: {},
      });
    }

    // Sort by name
    folders.sort((a, b) => a.name.localeCompare(b.name));

    const response = SUCCESS.json('Folders retrieved successfully', { folders });
    
    // Disable caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting folders', {
      module: 'Media',
      label: 'GET_FOLDERS',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Create a new folder
 * POST /api/media/folders
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'manage_media');
    if (permissionError) return permissionError;

    const body = await req.json();
    const folderName = body.name?.trim();

    if (!folderName) {
      return ERROR.json('FOLDER_NAME_REQUIRED', { message: 'Folder name is required' });
    }

    // Validate folder name (no special characters except - and _)
    if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
      return ERROR.json('INVALID_FOLDER_NAME', {
        message: 'Folder name can only contain letters, numbers, hyphens, and underscores',
      });
    }

    // Check if folder already exists in database
    const existingFolder = await prisma.media.findFirst({
      where: {
        folder: folderName,
      },
    });

    // Check if physical folder exists
    const publicDir = path.join(process.cwd(), 'public', 'uploads');
    const folderPath = path.join(publicDir, folderName);
    
    let folderExists = false;
    try {
      await fs.access(folderPath);
      folderExists = true;
    } catch {
      folderExists = false;
    }

    if (existingFolder || folderExists) {
      return ERROR.json('FOLDER_EXISTS', { message: 'Folder already exists' });
    }

    // Create the physical folder in public/uploads directory
    try {
      // Ensure the uploads directory exists first
      await fs.mkdir(publicDir, { recursive: true });
      // Create the new folder
      await fs.mkdir(folderPath, { recursive: true });
      
      logger.info('Physical folder created', {
        module: 'Media',
        label: 'CREATE_FOLDER_PHYSICAL',
        extraData: { folder_path: folderPath },
      });
    } catch (fsError) {
      logger.error('Failed to create physical folder', {
        module: 'Media',
        label: 'CREATE_FOLDER_FS_ERROR',
        extraData: { 
          folder_path: folderPath,
          error: fsError instanceof Error ? fsError.message : 'Unknown error',
        },
      });
      return ERROR.json('FOLDER_CREATE_FAILED', { 
        message: 'Failed to create folder on disk',
      });
    }

    logger.info('Folder created', {
      module: 'Media',
      label: 'CREATE_FOLDER',
      extraData: { folder_name: folderName, user_id: user?.uid || user?.user_id },
    });

    const folder = {
      name: folderName,
      path: folderName,
      file_count: 0,
      total_size: 0,
      by_type: {},
    };

    // Emit WebSocket event for real-time update
    try {
      const { emitFolderCreated } = await import('@lib/websocket/emitter');
      emitFolderCreated(folder, user?.uid || user?.user_id);
    } catch (wsError) {
      logger.warning('Failed to emit folder created WebSocket event', {
        module: 'Media',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
      });
    }

    return SUCCESS.json('Folder created successfully', { folder });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating folder', {
      module: 'Media',
      label: 'CREATE_FOLDER_ERROR',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

