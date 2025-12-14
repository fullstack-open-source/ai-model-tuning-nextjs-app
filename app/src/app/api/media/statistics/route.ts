import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';

/**
 * Get media statistics
 * GET /api/media/statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_media');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;

    const fetchStatistics = async () => {
      try {
        // Build where clause: show public to all, private only to owner
        const where: any = {
          OR: [
            { is_public: true },
            { user_id: userId },
          ],
        };

        // Execute queries with error handling and timeout protection
        const queries = await Promise.allSettled([
          prisma.media.count({ where }),
          prisma.media.groupBy({
            by: ['mime_type'],
            where,
            _count: { mime_type: true },
            _sum: { size: true },
          }),
          prisma.media.groupBy({
            by: ['is_public'],
            where,
            _count: { is_public: true },
          }),
          prisma.media.aggregate({
            where,
            _sum: { size: true },
          }),
        ]);

        // Extract results with fallback values
        const total = queries[0].status === 'fulfilled' ? queries[0].value : 0;
        const byType = queries[1].status === 'fulfilled' ? queries[1].value : [];
        const byVisibility = queries[2].status === 'fulfilled' ? queries[2].value : [];
        const totalSize = queries[3].status === 'fulfilled' ? queries[3].value : { _sum: { size: null } };

        // Log any failed queries
        queries.forEach((query, index) => {
          if (query.status === 'rejected') {
            logger.warning('Media statistics query failed', {
              module: 'Media',
              label: 'GET_MEDIA_STATISTICS_QUERY_ERROR',
              extraData: { 
                queryIndex: index,
                error: query.reason instanceof Error ? query.reason.message : String(query.reason)
              },
            });
          }
        });

        // Convert to expected format
        const byTypeRecord: Record<string, { count: number; size: number }> = {};
        if (Array.isArray(byType)) {
          byType.forEach((item: any) => {
            if (item.mime_type) {
              // Map mime_type to file type category
              const fileType = item.mime_type.startsWith('image/') ? 'image'
                : item.mime_type.startsWith('video/') ? 'video'
                : item.mime_type.startsWith('audio/') ? 'audio'
                : item.mime_type.includes('pdf') || item.mime_type.includes('document') || item.mime_type.includes('text') ? 'document'
                : item.mime_type.includes('zip') || item.mime_type.includes('rar') || item.mime_type.includes('tar') ? 'archive'
                : 'other';
              
              if (!byTypeRecord[fileType]) {
                byTypeRecord[fileType] = { count: 0, size: 0 };
              }
              byTypeRecord[fileType].count += item._count.mime_type || 0;
              byTypeRecord[fileType].size += Number(item._sum.size || 0);
            }
          });
        }

        const byVisibilityRecord: Record<string, number> = {};
        if (Array.isArray(byVisibility)) {
          byVisibility.forEach((item: any) => {
            const key = item.is_public ? 'public' : 'private';
            byVisibilityRecord[key] = (byVisibilityRecord[key] || 0) + (item._count.is_public || 0);
          });
        }

        return {
          total_files: total || 0,
          total_size: Number(totalSize._sum.size || 0),
          by_type: byTypeRecord,
          by_visibility: byVisibilityRecord,
        };
      } catch (dbError: unknown) {
        logger.error('Database error in media statistics', {
          module: 'Media',
          label: 'GET_MEDIA_STATISTICS_DB_ERROR',
          extraData: { 
            error: dbError instanceof Error ? dbError.message : String(dbError),
            stack: dbError instanceof Error ? dbError.stack : undefined
          },
        });
        
        // Return empty statistics on error instead of throwing
        return {
          total_files: 0,
          total_size: 0,
          by_type: {},
          by_visibility: {},
        };
      }
    };

    // Fetch statistics directly (no cache - always fresh)
    const statistics = await fetchStatistics();

    const response = SUCCESS.json('Media statistics retrieved successfully', { statistics });
    
    // Disable caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting media statistics', {
      module: 'Media',
      label: 'GET_MEDIA_STATISTICS',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
