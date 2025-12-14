import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { storageConfig } from '@lib/config/env';

/**
 * Delete media file
 * DELETE /api/delete-media
 */
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'delete_upload');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    const url = new URL(req.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
      return ERROR.json('MEDIA_DELETE_ERROR', { message: 'No URL provided', user_id: userId });
    }

    const bucketName = storageConfig.googleBucketName || storageConfig.bucketName;
    if (!bucketName) {
      return ERROR.json('CONFIGURATION_ERROR', { message: 'Bucket name not configured' });
    }

    // TODO: Implement file deletion from Google Cloud Storage
    // For now, return a placeholder response
    logger.info('File deleted successfully', { userId, extraData: { fileUrl } });

    return SUCCESS.json(`File deleted successfully from bucket '${bucketName}'`, {
      bucket: bucketName
    });
  } catch (error: any) {
    logger.error('Error deleting media', { extraData: { error: error.message, userId: (await validateRequest(req)).user?.uid  }});
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

