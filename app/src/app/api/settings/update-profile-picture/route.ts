import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { prisma } from '@lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { storageConfig } from '@lib/config/env';

/**
 * Update Profile Picture
 * POST /api/settings/update-profile-picture
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'update_profile_picture');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', { message: 'No file provided' });
    }

    const fileData = await file.arrayBuffer();
    const buffer = Buffer.from(fileData);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const contentType = file.type || 'application/octet-stream';

    const objectKey = `${user.user_name || userId}-user_id_${userId}-|-${uuidv4()}.${extension}`;
    const folder = 'media/users';

    // TODO: Implement actual GCS upload
    // For now, return placeholder URL
    const publicUrl = `https://storage.googleapis.com/${storageConfig.googleBucketName}/${folder}/${objectKey}`;

    // Update profile picture in database
    try {
      await prisma.user.update({
        where: { user_id: userId },
        data: { profile_picture_url: publicUrl },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return ERROR.json('PROFILE_PICTURE_UPDATE_FAILED', { user_id: userId });
      }
      throw error;
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateAllUserRelatedCache(userId);

    return SUCCESS.json('Profile picture updated successfully', {
      profile_picture_url: publicUrl,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating profile picture', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_PICTURE',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}
