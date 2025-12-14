/**
 * Image Cache Utility
 * Handles browser-level image caching with preloading
 */

interface ImageCacheEntry {
  url: string;
  image: HTMLImageElement;
  loaded: boolean;
  timestamp: number;
}

class ImageCache {
  private cache: Map<string, ImageCacheEntry> = new Map();
  private loading: Set<string> = new Set();
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of cached images

  /**
   * Preload and cache an image
   */
  async preload(url: string): Promise<HTMLImageElement> {
    // Check if already cached
    const cached = this.cache.get(url);
    if (cached && cached.loaded) {
      return cached.image;
    }

    // Check if already loading
    if (this.loading.has(url)) {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const entry = this.cache.get(url);
          if (entry && entry.loaded) {
            clearInterval(checkInterval);
            resolve(entry.image);
          }
        }, 50);
      });
    }

    // Start loading
    this.loading.add(url);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        // Clean up old entries if cache is full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
          this.evictOldest();
        }

        this.cache.set(url, {
          url,
          image: img,
          loaded: true,
          timestamp: Date.now(),
        });
        
        this.loading.delete(url);
        resolve(img);
      };

      img.onerror = () => {
        this.loading.delete(url);
        reject(new Error(`Failed to load image: ${url}`));
      };

      // Set crossOrigin for CORS
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  /**
   * Get cached image
   */
  get(url: string): HTMLImageElement | null {
    const entry = this.cache.get(url);
    return entry && entry.loaded ? entry.image : null;
  }

  /**
   * Check if image is cached
   */
  has(url: string): boolean {
    return this.cache.has(url) && this.cache.get(url)!.loaded;
  }

  /**
   * Remove from cache
   */
  remove(url: string): void {
    this.cache.delete(url);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.loading.clear();
  }

  /**
   * Evict oldest entries
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Preload multiple images
   */
  async preloadMultiple(urls: string[]): Promise<void> {
    await Promise.allSettled(urls.map(url => this.preload(url).catch(() => {})));
  }
}

// Singleton instance
export const imageCache = new ImageCache();

