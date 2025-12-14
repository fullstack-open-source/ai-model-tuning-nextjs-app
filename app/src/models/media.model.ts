/**
 * Media Model
 * Defines media/file storage data structures
 */

export interface Media {
  media_id: string;
  user_id?: string | null;
  
  // File Information
  file_name: string;
  original_name: string;
  file_type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
  mime_type: string;
  file_extension?: string | null;
  file_size: number; // Size in bytes
  
  // Storage Information
  storage_provider: 'local' | 'google' | 'aws' | 'azure';
  bucket_name?: string | null;
  storage_path: string;
  folder?: string | null;
  
  // URLs
  public_url?: string | null; // Public URL (only set if is_public = true) or access URL with access_key
  url?: string | null; // Alias for public_url (compatibility)
  cdn_url?: string | null;
  thumbnail_url?: string | null;
  
  // Access Control
  access_key?: string | null; // Unique access key for private media access
  visibility: 'public' | 'private' | 'authenticated';
  is_public: boolean;
  expires_at?: string | Date | null;
  
  // Image/Video Metadata
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  
  // Additional Metadata
  alt_text?: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  metadata?: Record<string, any> | null;
  
  // Checksums
  checksum_md5?: string | null;
  checksum_sha256?: string | null;
  
  // Status
  status: 'active' | 'processing' | 'failed' | 'deleted';
  is_trashed: boolean;
  trashed_at?: string | Date | null;
  
  // Timestamps
  created_at: string | Date;
  last_updated: string | Date;
  last_accessed?: string | Date | null;
  
  // User relationship
  user?: {
    user_id: string;
    first_name?: string;
    last_name?: string;
    user_name?: string;
    email?: string;
    profile_picture_url?: string;
  };
}

export interface MediaFilters {
  user_id?: string;
  file_type?: Media['file_type'];
  visibility?: Media['visibility'];
  status?: Media['status'];
  folder?: string;
  tags?: string[];
  search?: string;
  is_trashed?: boolean;
  limit?: number;
  offset?: number;
  order_by?: string;
  order?: 'asc' | 'desc';
}

export interface MediaStats {
  total_files: number;
  total_size: number; // Total size in bytes
  by_type: Record<string, { count: number; size: number }>;
  by_visibility: Record<string, number>;
  by_status: Record<string, number>;
  storage_used_percent?: number;
}

export interface MediaUploadResponse {
  media: Media;
  upload_url?: string;
}

export interface MediaFolder {
  name: string;
  path: string;
  file_count: number;
  total_size: number;
}

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to get file type from mime type
export function getFileTypeFromMime(mimeType: string): Media['file_type'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/pdf') || 
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith('application/vnd.openxmlformats-officedocument') ||
      mimeType.startsWith('text/')) return 'document';
  if (mimeType.startsWith('application/zip') ||
      mimeType.startsWith('application/x-rar') ||
      mimeType.startsWith('application/x-7z') ||
      mimeType.startsWith('application/gzip')) return 'archive';
  return 'other';
}

// Helper to get icon class based on file type
export function getFileTypeIcon(fileType: Media['file_type']): string {
  const icons: Record<Media['file_type'], string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Music',
    document: 'FileText',
    archive: 'Archive',
    other: 'File',
  };
  return icons[fileType] || 'File';
}

// Helper to get the display URL for media (uses public_url which contains access key for private files)
export function getMediaDisplayUrl(media: Media): string | null {
  return media.public_url || media.url || null;
}

// Helper to get the thumbnail URL for media (uses thumbnail_url if available, otherwise display URL)
export function getMediaThumbnailUrl(media: Media): string | null {
  return media.thumbnail_url || getMediaDisplayUrl(media);
}

// Helper to get cached URL with cache management
export function getCachedMediaUrl(media: Media): string | null {
  if (typeof window === 'undefined') {
    return getMediaDisplayUrl(media);
  }

  // Import cache dynamically to avoid SSR issues
  const { mediaCache } = require('@lib/cache/mediaCache');
  
  // Check cache first
  const cached = mediaCache.get(media.media_id, media.is_public);
  if (cached) {
    return cached;
  }

  // Get URL and cache it
  const url = getMediaDisplayUrl(media);
  if (url) {
    mediaCache.set(media.media_id, url, media.is_public);
  }
  
  return url;
}

// Helper to get cached thumbnail URL
export function getCachedThumbnailUrl(media: Media): string | null {
  if (typeof window === 'undefined') {
    return getMediaThumbnailUrl(media);
  }

  const { mediaCache } = require('@lib/cache/mediaCache');
  
  const cacheKey = `${media.media_id}_thumb`;
  const cached = mediaCache.get(cacheKey, media.is_public);
  if (cached) {
    return cached;
  }

  const url = getMediaThumbnailUrl(media);
  if (url) {
    mediaCache.set(cacheKey, url, media.is_public);
  }
  
  return url;
}

