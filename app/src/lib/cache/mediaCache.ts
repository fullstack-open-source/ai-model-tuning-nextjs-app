/**
 * Media Cache Management
 * Implements Google-like caching strategy for media files
 */

interface CacheEntry {
  url: string;
  timestamp: number;
  etag?: string;
  expiresAt: number;
}

class MediaCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year for public files
  private readonly PRIVATE_TTL = 60 * 60 * 1000; // 1 hour for private files

  /**
   * Get cached URL or return null
   */
  get(mediaId: string, isPublic: boolean = false): string | null {
    const entry = this.cache.get(mediaId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(mediaId);
      return null;
    }

    return entry.url;
  }

  /**
   * Set cache entry
   */
  set(mediaId: string, url: string, isPublic: boolean = false, etag?: string): void {
    const ttl = isPublic ? this.DEFAULT_TTL : this.PRIVATE_TTL;
    this.cache.set(mediaId, {
      url,
      timestamp: Date.now(),
      etag,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalidate cache for specific media
   */
  invalidate(mediaId: string): void {
    this.cache.delete(mediaId);
  }

  /**
   * Invalidate cache for multiple media items
   */
  invalidateMultiple(mediaIds: string[]): void {
    mediaIds.forEach(id => this.cache.delete(id));
  }

  /**
   * Invalidate all cache
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear cache for folder
   */
  invalidateFolder(folderName: string): void {
    // This would require tracking folder associations
    // For now, we'll invalidate all and let it rebuild
    this.invalidateAll();
  }

  /**
   * Invalidate list cache (for media list queries)
   */
  invalidateListCache(): void {
    // Invalidate all list-related cache entries
    // We use a special prefix for list cache keys
    for (const [key] of this.cache.entries()) {
      if (key.startsWith('list:') || key.startsWith('stats:')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Set list cache entry
   */
  setListCache(key: string, data: any, ttl: number = 60 * 1000): void {
    // Store list data with shorter TTL (1 minute default)
    this.cache.set(`list:${key}`, {
      url: JSON.stringify(data), // Store as JSON string
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Get list cache entry
   */
  getListCache(key: string): any | null {
    const entry = this.cache.get(`list:${key}`);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(`list:${key}`);
      return null;
    }

    try {
      return JSON.parse(entry.url);
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const mediaCache = new MediaCache();

// Clean expired entries every hour
if (typeof window !== 'undefined') {
  setInterval(() => {
    mediaCache.cleanExpired();
  }, 60 * 60 * 1000);
}

