import { NextRequest, NextResponse } from 'next/server';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { prisma } from '@lib/db/prisma';
import fs from 'fs/promises';
import path from 'path';

/**
 * Get media file with access key
 * GET /api/media/[media_id]/access/[access_key]
 * 
 * This route allows anyone with a valid access key to access the media file.
 * No authentication or owner check is required - the access key is sufficient.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ media_id: string; access_key: string }> }
) {
  try {
    const { media_id, access_key } = await params;

    // First, try to get media access record
    let mediaAccess = await prisma.mediaAccess.findFirst({
      where: {
        media_id,
        access_key,
        is_active: true,
      },
      include: {
        media: true,
      },
    });

    // If no access record found, check if media exists and access key matches directly
    // This allows access keys stored directly in media metadata or as a fallback
    if (!mediaAccess) {
      const media = await prisma.media.findUnique({
        where: { media_id },
      });

      if (!media) {
        return ERROR.json('MEDIA_NOT_FOUND', { message: 'Media file not found' });
      }

      // If media is public, allow access (though this route is typically for private media)
      if (media.is_public) {
        // Serve public media directly
        const filePath = path.isAbsolute(media.path)
          ? media.path
          : path.join(process.cwd(), 'public', media.path);

        try {
          const fileBuffer = await fs.readFile(filePath);
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': media.mime_type,
              'Content-Disposition': `inline; filename="${media.original_name}"`,
              'Cache-Control': 'public, max-age=31536000',
            },
          });
        } catch (fileError) {
          logger.error('File not found', {
            module: 'Media',
            extraData: { media_id, path: filePath },
          });
          return ERROR.json('FILE_NOT_FOUND', { media_id });
        }
      }

      // For private media, access key must exist in MediaAccess table
      return ERROR.json('MEDIA_ACCESS_DENIED', { message: 'Invalid access key' });
    }

    // Check expiration
    if (mediaAccess.expires_at && new Date(mediaAccess.expires_at) < new Date()) {
      return ERROR.json('MEDIA_ACCESS_EXPIRED', { message: 'Access has expired' });
    }

    const media = mediaAccess.media;

    // Read and serve file
    const filePath = path.isAbsolute(media.path)
      ? media.path
      : path.join(process.cwd(), 'public', media.path);

    try {
      const fileBuffer = await fs.readFile(filePath);

      // Update accessed_at
      await prisma.mediaAccess.update({
        where: { access_id: mediaAccess.access_id },
        data: { accessed_at: new Date() },
      });

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': media.mime_type,
          'Content-Disposition': `inline; filename="${media.original_name}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (fileError) {
      logger.error('File not found', {
        module: 'Media',
        extraData: { media_id, path: filePath },
      });
      return ERROR.json('FILE_NOT_FOUND', { media_id });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error serving media with access key', {
      module: 'Media',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
