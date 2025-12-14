/**
 * Media Service
 * Handles media/file storage API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { Media, MediaFilters, MediaStats, MediaUploadResponse, MediaFolder } from '@models/media.model';
import type { ApiResponse, PaginatedResponse } from '@models/api.model';

class MediaService {
  private api: ApiService;

  constructor() {
    this.api = createPublicApiService();
  }

  /**
   * Set authenticated API service
   */
  setAuthApi(api: ApiService) {
    this.api = api;
  }

  /**
   * Get media files list
   */
  async getMedia(filters?: MediaFilters): Promise<PaginatedResponse<Media>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    const query = params.toString();
    return await this.api.get<PaginatedResponse<Media>>(
      `/media${query ? `?${query}` : ''}`
    );
  }

  /**
   * Refresh media files list (bypass cache)
   */
  async refreshMedia(filters?: MediaFilters): Promise<PaginatedResponse<Media>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    params.append('_refresh', String(Date.now()));
    const query = params.toString();
    return await this.api.get<PaginatedResponse<Media>>(
      `/media${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get single media file by ID
   */
  async getMediaById(mediaId: string): Promise<ApiResponse<Media>> {
    return await this.api.get<ApiResponse<Media>>(`/media/${mediaId}`);
  }

  /**
   * Upload media file
   */
  async uploadMedia(file: File, options?: {
    folder?: string;
    visibility?: 'public' | 'private' | 'authenticated';
    storage_type?: 'local' | 'cloud';
    title?: string;
    description?: string;
    alt_text?: string;
    tags?: string[];
  }): Promise<ApiResponse<MediaUploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options) {
      if (options.folder) formData.append('folder', options.folder);
      if (options.visibility) formData.append('visibility', options.visibility);
      if (options.storage_type) formData.append('storage_type', options.storage_type);
      if (options.title) formData.append('title', options.title);
      if (options.description) formData.append('description', options.description);
      if (options.alt_text) formData.append('alt_text', options.alt_text);
      if (options.tags) formData.append('tags', options.tags.join(','));
    }

    return await this.api.upload<ApiResponse<MediaUploadResponse>>('/media/upload', formData);
  }

  /**
   * Upload multiple media files
   */
  async uploadMultipleMedia(files: File[], options?: {
    folder?: string;
    visibility?: 'public' | 'private' | 'authenticated';
  }): Promise<ApiResponse<{ media: Media[]; failed: string[] }>> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    if (options) {
      if (options.folder) formData.append('folder', options.folder);
      if (options.visibility) formData.append('visibility', options.visibility);
    }

    return await this.api.upload<ApiResponse<{ media: Media[]; failed: string[] }>>('/media/upload/bulk', formData);
  }

  /**
   * Update media metadata
   */
  async updateMedia(mediaId: string, data: Partial<Pick<Media, 
    'title' | 'description' | 'alt_text' | 'visibility' | 'folder' | 'tags' | 'is_public'
  >>): Promise<ApiResponse<Media>> {
    // Map visibility to is_public if provided
    const updateData: any = { ...data }
    if ('visibility' in updateData && updateData.visibility !== undefined) {
      updateData.is_public = updateData.visibility === 'public'
      delete updateData.visibility
    }
    return await this.api.patch<ApiResponse<Media>>(`/media/${mediaId}`, updateData);
  }

  /**
   * Delete media file
   */
  async deleteMedia(mediaId: string, permanent?: boolean): Promise<ApiResponse<void>> {
    const query = permanent ? '?permanent=true' : '';
    return await this.api.delete<ApiResponse<void>>(`/media/${mediaId}${query}`);
  }

  /**
   * Delete multiple media files
   */
  async deleteMultipleMedia(mediaIds: string[], permanent?: boolean): Promise<ApiResponse<{ deleted: string[]; failed: string[] }>> {
    return await this.api.post<ApiResponse<{ deleted: string[]; failed: string[] }>>('/media/delete/bulk', {
      media_ids: mediaIds,
      permanent,
    });
  }

  /**
   * Move media to trash
   */
  async trashMedia(mediaId: string): Promise<ApiResponse<Media>> {
    return await this.api.post<ApiResponse<Media>>(`/media/${mediaId}/trash`, {});
  }

  /**
   * Restore media from trash
   */
  async restoreMedia(mediaId: string): Promise<ApiResponse<Media>> {
    return await this.api.post<ApiResponse<Media>>(`/media/${mediaId}/restore`, {});
  }

  /**
   * Get media statistics
   */
  async getMediaStats(): Promise<ApiResponse<MediaStats>> {
    return await this.api.get<ApiResponse<MediaStats>>('/media/statistics');
  }

  /**
   * Get folders list with statistics
   */
  async getFolders(): Promise<ApiResponse<{ folders: MediaFolder[] }>> {
    return await this.api.get<ApiResponse<{ folders: MediaFolder[] }>>('/media/folders');
  }

  /**
   * Create a new folder
   */
  async createFolder(folderName: string): Promise<ApiResponse<{ folder: MediaFolder }>> {
    return await this.api.post<ApiResponse<{ folder: MediaFolder }>>('/media/folders', {
      name: folderName,
    });
  }

  /**
   * Update folder name (rename)
   */
  async updateFolder(oldName: string, newName: string): Promise<ApiResponse<{ folder: MediaFolder }>> {
    return await this.api.patch<ApiResponse<{ folder: MediaFolder }>>(`/media/folders/${encodeURIComponent(oldName)}`, {
      name: newName,
    });
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderName: string): Promise<ApiResponse<void>> {
    return await this.api.delete<ApiResponse<void>>(`/media/folders/${encodeURIComponent(folderName)}`);
  }

  /**
   * Get signed URL for private file
   */
  async getSignedUrl(mediaId: string, expiresIn?: number): Promise<ApiResponse<{ url: string; expires_at: string }>> {
    const query = expiresIn ? `?expires_in=${expiresIn}` : '';
    return await this.api.get<ApiResponse<{ url: string; expires_at: string }>>(`/media/${mediaId}/signed-url${query}`);
  }

  /**
   * Copy media file
   */
  async copyMedia(mediaId: string, destinationFolder?: string): Promise<ApiResponse<Media>> {
    return await this.api.post<ApiResponse<Media>>(`/media/${mediaId}/copy`, {
      destination_folder: destinationFolder,
    });
  }

  /**
   * Move media file to different folder
   */
  async moveMedia(mediaId: string, destinationFolder: string): Promise<ApiResponse<Media>> {
    return await this.api.post<ApiResponse<Media>>(`/media/${mediaId}/move`, {
      destination_folder: destinationFolder,
    });
  }
}

// Export singleton instance
export const mediaService = new MediaService();

