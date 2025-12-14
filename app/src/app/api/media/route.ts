import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';

/**
 * Get media files list
 * GET /api/media
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_media');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    const url = new URL(req.url);
    
    // Parse filters
    const filters = {
      user_id: url.searchParams.get('user_id') || undefined,
      mime_type: url.searchParams.get('mime_type') || url.searchParams.get('file_type') || undefined,
      is_public: url.searchParams.get('is_public') === 'true' ? true : url.searchParams.get('is_public') === 'false' ? false : undefined,
      folder: url.searchParams.get('folder') || undefined,
      search: url.searchParams.get('search') || undefined,
    };

    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const orderBy = url.searchParams.get('order_by') || 'created_at';
    const order = url.searchParams.get('order') || 'desc';

    // Skip server-side caching - media list changes frequently
    // Use direct database queries for fresh data always
    const fetchMediaData = async () => {
      const baseWhere: Record<string, unknown> = {};

      // Apply filters
      if (filters.user_id) baseWhere.user_id = filters.user_id;
      if (filters.mime_type) baseWhere.mime_type = { contains: filters.mime_type };
      if (filters.folder) baseWhere.folder = filters.folder;
      
      // Build search filter
      const searchFilter = filters.search ? {
        OR: [
          { filename: { contains: filters.search, mode: 'insensitive' } },
          { original_name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      } : {};

      // Build visibility filter: public OR owned by user
      const visibilityFilter = {
        OR: [
          { is_public: true },
          { user_id: userId },
        ],
      };

      // Combine all filters
      const where: any = {
        ...baseWhere,
        ...searchFilter,
        AND: [
          visibilityFilter,
          ...(filters.is_public !== undefined ? [{ is_public: filters.is_public }] : []),
        ],
      };

      const [media, total] = await Promise.all([
        prisma.media.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { [orderBy]: order },
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
        }),
        prisma.media.count({ where }),
      ]);

      // Filter media: show public to all, private only to owner
      const filteredMedia = media.filter((m: any) => {
        if (m.is_public) {
          return true; // Public media visible to all
        }
        // Private media only visible to owner
        return m.user_id === userId;
      });

      // Map database fields to API model and generate URLs
      const { generateMediaUrlWithKey, generatePublicMediaUrl } = await import('@lib/media/url-helper');
      const mappedMedia = await Promise.all(
        filteredMedia.map(async (m: any) => {
          let mediaUrl: string | null = null;
          let access_key: string | null = null;

          if (m.is_public) {
            // For public media, use direct file path from storage path
            // path is like "uploads/folder/filename.jpg" 
            mediaUrl = generatePublicMediaUrl(m.path || `uploads/${m.folder || 'uploads'}/${m.filename}`);
          } else {
            // For private media, generate URL with access key
            const result = await generateMediaUrlWithKey(
              {
                media_id: m.media_id,
                filename: m.filename,
                is_public: m.is_public,
                user_id: m.user_id,
              },
              userId
            );
            mediaUrl = result.url;
            access_key = result.access_key;
          }

          return {
            ...m,
            file_size: m.size || 0,
            file_name: m.filename,
            file_type: m.mime_type?.startsWith('image/') ? 'image' 
              : m.mime_type?.startsWith('video/') ? 'video'
              : m.mime_type?.startsWith('audio/') ? 'audio'
              : m.mime_type?.includes('pdf') || m.mime_type?.includes('document') || m.mime_type?.includes('text') ? 'document'
              : m.mime_type?.includes('zip') || m.mime_type?.includes('rar') || m.mime_type?.includes('tar') ? 'archive'
              : 'other',
            storage_path: m.path,
            public_url: mediaUrl, // Full URL with access key for private, public URL for public
            url: mediaUrl, // Alias for compatibility
            access_key: access_key, // Access key for private media
            visibility: m.is_public ? 'public' : 'private',
            status: 'active',
            is_trashed: false,
          };
        })
      );

      return {
        media: mappedMedia,
        total,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    };

    // Fetch data directly (no server-side caching for media list)
    const result = await fetchMediaData();

    // Add cache headers to response - no cache for media list
    const response = SUCCESS.json('Media files retrieved successfully', result);
    
    // Disable caching to ensure fresh data on every request
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting media files', {
      module: 'Media',
      label: 'GET_MEDIA',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

