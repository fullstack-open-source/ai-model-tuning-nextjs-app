import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { appConfig } from '@lib/config/env';
import { prisma } from '@lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { ensureAccessKey, generatePrivateMediaUrl } from '@lib/media/url-helper';

/**
 * Upload media file
 * POST /api/media/upload
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'add_upload');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return ERROR.json('MEDIA_FILE_REQUIRED', { message: 'No file provided' });
    }

    // Get optional metadata
    const folder = formData.get('folder') as string || 'uploads';
    const visibility = (formData.get('visibility') as string) || 'private';
    const description = formData.get('description') as string || null;
    const altText = formData.get('alt_text') as string || null;

    // Generate unique file name
    const fileExtension = file.name.split('.').pop() || '';
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get base URL for generating full paths
    const baseUrl = appConfig.publicUrl || 'http://localhost:3000';
    
    // Local storage - save file to public/uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', folder);
    
    // Ensure directory exists
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create uploads directory', {
        module: 'Media',
        extraData: { error, path: uploadsDir },
      });
      return ERROR.json('DIRECTORY_CREATE_FAILED', { message: 'Failed to create upload directory' });
    }

    // Save file locally
    const filePath = path.join(uploadsDir, uniqueFileName);
    const storagePath = `uploads/${folder}/${uniqueFileName}`;
    
    try {
      await fs.writeFile(filePath, buffer);
    } catch (error) {
      logger.error('Failed to save file locally', {
        module: 'Media',
        extraData: { error, filePath },
      });
      return ERROR.json('FILE_SAVE_FAILED', { message: 'Failed to save file' });
    }
    
    // Create media record in database
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User ID required' });
    }
    
    const isPublic = visibility === 'public';
    
    const media = await prisma.media.create({
      data: {
        user_id: userId,
        filename: uniqueFileName,
        original_name: file.name,
        mime_type: file.type,
        size: file.size,
        path: storagePath,
        url: null, // Will be set after access key creation for private media
        folder: folder,
        is_public: isPublic,
        alt_text: altText,
        description: description,
        metadata: {
          original_extension: fileExtension,
          uploaded_at: new Date().toISOString(),
        },
      },
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

    // Generate access key and URL for private media
    let finalUrl: string | null = null;
    if (!isPublic) {
      // Create access key for private media (anyone with key can access)
      const accessKey = await ensureAccessKey(media.media_id, userId);
      finalUrl = generatePrivateMediaUrl(media.media_id, accessKey);
      
      // Update media with the access URL
      await prisma.media.update({
        where: { media_id: media.media_id },
        data: { url: finalUrl },
      });
      
      // Update the media object for response
      (media as any).url = finalUrl;
    } else {
      // Public media - use direct file URL from storage path
      const { generatePublicMediaUrl } = await import('@lib/media/url-helper');
      finalUrl = generatePublicMediaUrl(storagePath);
      
      // Update media with the public URL
      await prisma.media.update({
        where: { media_id: media.media_id },
        data: { url: finalUrl },
      });
      
      // Update the media object for response
      (media as any).url = finalUrl;
    }

    logger.info('Media file uploaded successfully', {
      module: 'Media',
      label: 'UPLOAD',
      extraData: { 
        media_id: media.media_id,
        user_id: userId,
        filename: file.name,
        size: file.size,
        is_public: visibility === 'public',
      },
    });

    // Invalidate cache for new upload
    try {
      const { invalidateCache } = await import('@lib/middleware/cache');
      await invalidateCache(undefined, [
        `media:list:*`,
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
      const { emitMediaCreated } = await import('@lib/websocket/emitter');
      emitMediaCreated(media, userId);
    } catch (wsError) {
      logger.warning('Failed to emit media created WebSocket event', {
        module: 'Media',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
      });
    }

    const response = SUCCESS.json('File uploaded successfully', { media }, {}, 201);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error uploading media', {
      module: 'Media',
      label: 'UPLOAD_ERROR',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
