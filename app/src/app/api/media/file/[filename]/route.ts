import { NextRequest, NextResponse } from 'next/server';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { prisma } from '@lib/db/prisma';
import fs from 'fs/promises';
import path from 'path';

/**
 * Get media file by filename
 * GET /api/media/file/[filename]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Get media record by filename
    const media = await prisma.media.findFirst({
      where: { filename },
    });

    if (!media) {
      return ERROR.json('MEDIA_NOT_FOUND', { filename });
    }

    // Check if public or user has access
    if (!media.is_public) {
      return ERROR.json('MEDIA_ACCESS_DENIED', { message: 'This file is not public' });
    }

    // Read and serve file
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
        extraData: { filename, path: filePath },
      });
      return ERROR.json('FILE_NOT_FOUND', { filename });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error serving media by filename', {
      module: 'Media',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
