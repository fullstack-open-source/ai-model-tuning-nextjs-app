/**
 * Media URL Helper
 * Generates proper URLs for media files with access control
 */

import { appConfig } from '@lib/config/env';
import { prisma } from '@lib/db/prisma';
import crypto from 'crypto';

/**
 * Generate a secure access key for private media
 */
export function generateAccessKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get base URL for API endpoints
 */
function getBaseUrl(): string {
  return appConfig.publicUrl || 'http://localhost:3000';
}

/**
 * Generate full URL for public media from storage path
 * Public files are served directly from the public/ folder by Next.js
 * @param pathOrFilename - The storage path (e.g. "uploads/folder/filename.jpg") or just filename
 */
export function generatePublicMediaUrl(pathOrFilename: string): string {
  const baseUrl = getBaseUrl();
  // Public files are served directly by Next.js from public/ folder
  // Storage path in DB is like "uploads/folder/filename.jpg"
  // URL should be "/uploads/folder/filename.jpg" which maps to "public/uploads/folder/filename.jpg"
  
  // If the path already starts with "uploads/", use it directly
  if (pathOrFilename.startsWith('uploads/')) {
    return `${baseUrl}/${pathOrFilename}`;
  }
  // Otherwise prepend "uploads/"
  return `${baseUrl}/uploads/${pathOrFilename}`;
}

/**
 * Generate full URL for private media with access key
 * Private files are served via the API route (Next.js file-based routing)
 * Route: /api/media/[media_id]/access/[access_key]
 */
export function generatePrivateMediaUrl(mediaId: string, accessKey: string): string {
  const baseUrl = getBaseUrl();
  // Use direct Next.js API route - no /dev/v1 prefix since we're not going through Axios
  return `${baseUrl}/api/media/${mediaId}/access/${accessKey}`;
}

/**
 * Ensure access key exists for private media
 * Creates one if it doesn't exist
 * For private media, always creates an access key (user_id can be null for link-based access)
 */
export async function ensureAccessKey(mediaId: string, userId?: string | null): Promise<string> {
  // Check if access key already exists (prefer user-specific if userId provided)
  const existingAccess = await prisma.mediaAccess.findFirst({
    where: {
      media_id: mediaId,
      is_active: true,
      // If userId provided, prefer user-specific access, otherwise any active access
      ...(userId ? { user_id: userId } : {}),
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (existingAccess) {
    return existingAccess.access_key;
  }

  // Create new access key
  // For private media, access key allows anyone with the key to access (no user_id required)
  const accessKey = generateAccessKey();
  await prisma.mediaAccess.create({
    data: {
      media_id: mediaId,
      access_key: accessKey,
      user_id: userId || null, // null means link-based access (anyone with key can access)
      access_type: 'view',
      is_active: true,
      // No expiration by default - access key works indefinitely unless manually revoked
    },
  });

  return accessKey;
}

/**
 * Generate media URL and access key based on visibility
 * Returns full URL with access key for private media
 * Returns full public URL for public media
 */
export async function generateMediaUrlWithKey(
  media: {
    media_id: string;
    filename: string;
    is_public: boolean;
    user_id?: string;
  },
  currentUserId?: string
): Promise<{ url: string | null; access_key: string | null }> {
  if (media.is_public) {
    // Public media - use direct file URL, no access key needed
    return {
      url: generatePublicMediaUrl(media.filename),
      access_key: null,
    };
  } else {
    // Private media - check if user is owner or has access
    if (currentUserId && media.user_id === currentUserId) {
      // Owner can access - generate URL with access key
      const accessKey = await ensureAccessKey(media.media_id, currentUserId);
      return {
        url: generatePrivateMediaUrl(media.media_id, accessKey),
        access_key: accessKey,
      };
    }
    // Not owner and not public - return null (no access)
    return {
      url: null,
      access_key: null,
    };
  }
}

/**
 * Generate media URL based on visibility
 * Returns full URL with access key for private media
 * Returns full public URL for public media
 */
export async function generateMediaUrl(
  media: {
    media_id: string;
    filename: string;
    is_public: boolean;
    user_id?: string;
  },
  currentUserId?: string
): Promise<string | null> {
  const result = await generateMediaUrlWithKey(media, currentUserId);
  return result.url;
}

/**
 * Generate media URL for a list of media items
 */
export async function generateMediaUrls(
  mediaList: Array<{
    media_id: string;
    filename: string;
    is_public: boolean;
    user_id?: string;
  }>,
  currentUserId?: string
): Promise<Array<{ media_id: string; url: string | null }>> {
  const results = await Promise.all(
    mediaList.map(async (media) => {
      const url = await generateMediaUrl(media, currentUserId);
      return { media_id: media.media_id, url };
    })
  );
  return results;
}

