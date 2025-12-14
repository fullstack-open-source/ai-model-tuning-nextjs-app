import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';
import { generateMediaUrlWithKey } from '@lib/media/url-helper';

/**
 * Get media file details
 * GET /api/media/[media_id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ media_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_media');
    if (permissionError) return permissionError;

    const { media_id } = await params;

    const media = await prisma.media.findUnique({
      where: { media_id },
      include: {
        user: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true,
          },
        },
      },
    });

    if (!media) {
      return ERROR.json('MEDIA_NOT_FOUND', { media_id });
    }

    const userId = user?.uid || user?.user_id;

    // Check access: public media visible to all, private only to owner
    if (!(media as any).is_public && (media as any).user_id !== userId) {
      return ERROR.json('MEDIA_ACCESS_DENIED', { 
        message: 'You do not have access to this private media file' 
      });
    }

    // Generate URL and access key based on visibility
    const { url: mediaUrl, access_key } = await generateMediaUrlWithKey(
      {
        media_id: media.media_id,
        filename: (media as any).filename,
        is_public: (media as any).is_public,
        user_id: (media as any).user_id,
      },
      userId
    );

    // Map database fields to API model
    const mappedMedia = {
      ...media,
      file_size: (media as any).size || 0,
      file_name: (media as any).filename,
      file_type: (media as any).mime_type?.startsWith('image/') ? 'image' 
        : (media as any).mime_type?.startsWith('video/') ? 'video'
        : (media as any).mime_type?.startsWith('audio/') ? 'audio'
        : (media as any).mime_type?.includes('pdf') || (media as any).mime_type?.includes('document') || (media as any).mime_type?.includes('text') ? 'document'
        : (media as any).mime_type?.includes('zip') || (media as any).mime_type?.includes('rar') || (media as any).mime_type?.includes('tar') ? 'archive'
        : 'other',
      storage_path: (media as any).path,
      public_url: mediaUrl, // Full URL with access key for private, public URL for public
      url: mediaUrl, // Alias for compatibility
      access_key: access_key, // Access key for private media
      visibility: (media as any).is_public ? 'public' : 'private',
      status: 'active',
      is_trashed: false,
    };

    return SUCCESS.json('Media file retrieved successfully', { media: mappedMedia });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting media file', {
      module: 'Media',
      label: 'GET_MEDIA_BY_ID',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Update media file metadata
 * PATCH /api/media/[media_id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ media_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'manage_media');
    if (permissionError) return permissionError;

    const { media_id } = await params;
    const body = await req.json();

    // Check if media exists
    const existingMedia = await prisma.media.findUnique({
      where: { media_id },
    });

    if (!existingMedia) {
      return ERROR.json('MEDIA_NOT_FOUND', { media_id });
    }

    // Build update data with only valid fields
    const updateData: Record<string, unknown> = {};
    if (body.description !== undefined) updateData.description = body.description;
    if (body.alt_text !== undefined) updateData.alt_text = body.alt_text;
    if (body.folder !== undefined) updateData.folder = body.folder;
    if (body.is_public !== undefined) updateData.is_public = body.is_public;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const updatedMedia = await prisma.media.update({
      where: { media_id },
      data: updateData,
      include: {
        user: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true,
          },
        },
      },
    });

    const userId = user?.uid || user?.user_id;

    // Generate URL and access key based on visibility
    const { url: mediaUrl, access_key } = await generateMediaUrlWithKey(
      {
        media_id: updatedMedia.media_id,
        filename: (updatedMedia as any).filename,
        is_public: (updatedMedia as any).is_public,
        user_id: (updatedMedia as any).user_id,
      },
      userId
    );

    // Map database fields to API model
    const media = {
      ...updatedMedia,
      file_size: (updatedMedia as any).size || 0,
      file_name: (updatedMedia as any).filename,
      file_type: (updatedMedia as any).mime_type?.startsWith('image/') ? 'image' 
        : (updatedMedia as any).mime_type?.startsWith('video/') ? 'video'
        : (updatedMedia as any).mime_type?.startsWith('audio/') ? 'audio'
        : (updatedMedia as any).mime_type?.includes('pdf') || (updatedMedia as any).mime_type?.includes('document') || (updatedMedia as any).mime_type?.includes('text') ? 'document'
        : (updatedMedia as any).mime_type?.includes('zip') || (updatedMedia as any).mime_type?.includes('rar') || (updatedMedia as any).mime_type?.includes('tar') ? 'archive'
        : 'other',
      storage_path: (updatedMedia as any).path,
      public_url: mediaUrl, // Full URL with access key for private, public URL for public
      url: mediaUrl, // Alias for compatibility
      access_key: access_key, // Access key for private media
      visibility: (updatedMedia as any).is_public ? 'public' : 'private',
      status: 'active',
      is_trashed: false,
    };

    logger.info('Media file updated successfully', {
      module: 'Media',
      label: 'UPDATE_MEDIA',
      extraData: { media_id, user_id: user?.uid || user?.user_id },
    });

    // Invalidate cache for this media
    try {
      const { invalidateCache } = await import('@lib/middleware/cache');
      await invalidateCache(undefined, [
        `media:list:*`,
        `media:${media_id}:*`,
        `media:statistics:*`
      ]);
    } catch (cacheError) {
      logger.warning('Failed to invalidate cache', {
        module: 'Media',
        extraData: { error: cacheError instanceof Error ? cacheError.message : 'Unknown error' },
      });
    }

    // Emit WebSocket event for real-time update
    try {
      const { emitMediaUpdated } = await import('@lib/websocket/emitter');
      emitMediaUpdated(media, user?.uid || user?.user_id);
    } catch (wsError) {
      logger.warning('Failed to emit media updated WebSocket event', {
        module: 'Media',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
      });
    }

    const response = SUCCESS.json('Media file updated successfully', { media });
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating media file', {
      module: 'Media',
      label: 'UPDATE_MEDIA_ERROR',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Delete media file
 * DELETE /api/media/[media_id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ media_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'delete_upload');
    if (permissionError) return permissionError;

    const { media_id } = await params;

    // Check if media exists
    const existingMedia = await prisma.media.findUnique({
      where: { media_id },
    });

    if (!existingMedia) {
      return ERROR.json('MEDIA_NOT_FOUND', { media_id });
    }

    // Delete actual file from storage
    try {
      if (existingMedia.path) {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        let filePathToDelete = existingMedia.path;
        
        // If path is relative, make it absolute
        if (!path.isAbsolute(filePathToDelete)) {
          filePathToDelete = path.join(process.cwd(), 'public', filePathToDelete);
        }
        
        try {
          await fs.access(filePathToDelete);
          await fs.unlink(filePathToDelete);
          logger.info('Physical file deleted from storage', {
            module: 'Media',
            label: 'DELETE_FILE_FROM_STORAGE',
            extraData: { path: filePathToDelete },
          });
        } catch (fileError) {
          logger.warning('File not found in storage', {
            module: 'Media',
            label: 'DELETE_FILE_NOT_FOUND',
            extraData: { 
              path: filePathToDelete,
              error: fileError instanceof Error ? fileError.message : 'Unknown error'
            },
          });
        }
      }
    } catch (fileError) {
      logger.error('Error deleting physical file', {
        module: 'Media',
        label: 'DELETE_FILE_ERROR',
        extraData: { error: fileError instanceof Error ? fileError.message : 'Unknown error' },
      });
    }

    // Delete from database
    await prisma.media.delete({
      where: { media_id },
    });

    logger.info('Media file deleted', {
      module: 'Media',
      label: 'DELETE_MEDIA',
      extraData: { media_id, user_id: user?.uid || user?.user_id },
    });

    // Invalidate caches
    try {
      const { invalidateCache } = await import('@lib/middleware/cache');
      await invalidateCache(undefined, [
        `media:list:*`,
        `media:${media_id}:*`,
        `media:statistics:*`
      ]);
    } catch (cacheError) {
      logger.warning('Failed to invalidate cache', {
        module: 'Media',
        extraData: { error: cacheError instanceof Error ? cacheError.message : 'Unknown error' },
      });
    }

    // Emit WebSocket event
    try {
      const { emitMediaDeleted } = await import('@lib/websocket/emitter');
      emitMediaDeleted(media_id, user?.uid || user?.user_id);
    } catch (wsError) {
      logger.warning('Failed to emit media deleted WebSocket event', {
        module: 'Media',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
      });
    }

    const response = SUCCESS.json('Media file deleted successfully', null);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting media file', {
      module: 'Media',
      label: 'DELETE_MEDIA_ERROR',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
