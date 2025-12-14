import { NextRequest, NextResponse } from 'next/server';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { prisma } from '@lib/db/prisma';
import fs from 'fs/promises';
import path from 'path';

/**
 * Get media file for authenticated access
 * GET /api/media/[media_id]/access
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ media_id: string }> }
) {
  try {
    const { media_id } = await params;

    // Get media record
    const media = await prisma.media.findUnique({
      where: { media_id },
    });

    if (!media) {
      return ERROR.json('MEDIA_NOT_FOUND', { media_id });
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
    logger.error('Error serving media', {
      module: 'Media',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
