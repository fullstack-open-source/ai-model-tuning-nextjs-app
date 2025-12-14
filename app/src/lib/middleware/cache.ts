/**
 * Cache Middleware
 * 
 * Flag-based caching middleware that can be easily enabled/disabled.
 * Implements cache-first strategy: Check Redis -> If miss, fetch from DB -> Cache -> Return
 * 
 * Usage:
 *   const cachedData = await withCache(
 *     () => fetchFromDatabase(),
 *     { key: 'my-cache-key', duration: 'medium' }
 *   );
 */

import { cache, CacheDuration, CacheTTL } from '@lib/cache/cache';
import { redisConfig } from '@lib/config/env';
import { logger } from '@lib/logger/logger';

export interface CacheOptions {
  key: string;
  duration?: CacheDuration;
  enabled?: boolean; // Override global cache setting
}

/**
 * Cache middleware wrapper for GET requests
 * Implements cache-first strategy: Redis -> DB -> Cache -> Return
 */
export async function withCache<T>(
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const { key, duration = 'medium', enabled } = options;
  
  // Check if caching is enabled (global flag or override)
  const cacheEnabled = enabled !== undefined ? enabled : redisConfig.enabled;
  
  if (!cacheEnabled) {
    // Cache disabled, directly fetch from database
    return fetcher();
  }

  try {
    // Step 1: Try to get from cache
    const cached = await cache.get<T>(key);
    if (cached !== null && cached !== undefined) {
      logger.debug('Cache hit', { 
        module: 'Cache', 
        label: 'CACHE_HIT',
        extraData: { key }
      });
      return cached;
    }

    // Step 2: Cache miss - fetch from database
    logger.debug('Cache miss', { 
      module: 'Cache', 
      label: 'CACHE_MISS',
      extraData: { key }
    });
    const data = await fetcher();

    // Step 3: Store in cache for future requests
    const ttl = CacheTTL[duration] ?? redisConfig.mediumTTL;
    try {
      await cache.set(key, data, ttl);
      
      // Verify cache was set successfully by attempting to retrieve it
      const verifyCache = await cache.get<T>(key);
      if (verifyCache !== null && verifyCache !== undefined) {
        logger.debug('Cache set and verified successfully', {
          module: 'Cache',
          label: 'CACHE_SET_VERIFIED',
          extraData: { key, duration, ttl, dataSize: JSON.stringify(data).length }
        });
      } else {
        logger.warning('Cache set but verification failed', {
          module: 'Cache',
          label: 'CACHE_SET_VERIFY_FAILED',
          extraData: { key, duration, ttl }
        });
      }
    } catch (cacheSetError) {
      // Log but don't fail the request if cache set fails
      logger.warning('Failed to set cache (non-critical)', {
        module: 'Cache',
        label: 'CACHE_SET_ERROR',
        extraData: {
          key,
          error: cacheSetError instanceof Error ? cacheSetError.message : String(cacheSetError),
        },
      });
    }

    return data;
  } catch (error) {
    // If cache fails, fallback to direct database fetch
    logger.warning('Cache error, falling back to database', {
      module: 'Cache',
      label: 'CACHE_ERROR',
      extraData: {
        key,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return fetcher();
  }
}

/**
 * Cache invalidation middleware for POST/PATCH/DELETE requests
 * Automatically invalidates related cache keys
 * 
 * Usage:
 *   await withCacheInvalidation(
 *     async () => {
 *       // Your mutation logic here
 *       await prisma.user.update(...)
 *     },
 *     {
 *       keys: ['user:123', 'users:list:*'], // Keys or patterns to invalidate
 *       enabled: true
 *     }
 *   );
 */
export interface CacheInvalidationOptions {
  keys?: string[]; // Specific keys to invalidate
  patterns?: string[]; // Patterns to match and invalidate (e.g., 'users:list:*')
  enabled?: boolean; // Override global cache setting
}

export async function withCacheInvalidation(
  invalidator: () => Promise<void>,
  options?: CacheInvalidationOptions
): Promise<void> {
  const cacheEnabled = options?.enabled !== undefined 
    ? options.enabled 
    : redisConfig.enabled;

  try {
    // First, run the invalidator (the actual mutation)
    await invalidator();

    // Then invalidate cache keys if caching is enabled
    if (cacheEnabled && (options?.keys || options?.patterns)) {
      const { keys = [], patterns = [] } = options;

      // Invalidate specific keys
      for (const key of keys) {
        try {
          await cache.delete(key);
          logger.debug('Cache key invalidated', {
            module: 'Cache',
            label: 'CACHE_INVALIDATED',
            extraData: { key }
          });
        } catch (error) {
          logger.warning('Failed to invalidate cache key', {
            module: 'Cache',
            label: 'CACHE_INVALIDATION_ERROR',
            extraData: {
              key,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      // Invalidate keys matching patterns
      for (const pattern of patterns) {
        try {
          const deletedCount = await cache.deleteByPattern(pattern);
          logger.debug('Cache pattern invalidated', {
            module: 'Cache',
            label: 'CACHE_PATTERN_INVALIDATED',
            extraData: { pattern, deletedCount }
          });
        } catch (error) {
          logger.warning('Failed to invalidate cache pattern', {
            module: 'Cache',
            label: 'CACHE_PATTERN_INVALIDATION_ERROR',
            extraData: {
              pattern,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    }
  } catch (error) {
    // Log error but don't throw - invalidation failure shouldn't break the request
    logger.warning('Cache invalidation error', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    // Re-throw the original error from invalidator
    throw error;
  }
}

/**
 * Helper to check if cache is enabled
 */
export function isCacheEnabled(): boolean {
  return redisConfig.enabled;
}

/**
 * Helper function to invalidate cache keys after mutations
 * This is a convenience wrapper around cache.delete and cache.deleteByPattern
 * 
 * Usage:
 *   await invalidateCache(['user:123'], ['users:list:*']);
 */
export async function invalidateCache(
  keys?: string[],
  patterns?: string[]
): Promise<void> {
  if (!redisConfig.enabled) {
    return;
  }

  try {
    // Invalidate specific keys
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => cache.delete(key)));
      logger.debug('Cache keys invalidated', {
        module: 'Cache',
        label: 'CACHE_KEYS_INVALIDATED',
        extraData: { keys }
      });
    }

    // Invalidate keys matching patterns
    if (patterns && patterns.length > 0) {
      const results = await Promise.all(
        patterns.map(async (pattern) => {
          const deletedCount = await cache.deleteByPattern(pattern);
          return { pattern, deletedCount };
        })
      );
      logger.debug('Cache patterns invalidated', {
        module: 'Cache',
        label: 'CACHE_PATTERNS_INVALIDATED',
        extraData: { results }
      });
    }
  } catch (error) {
    logger.warning('Cache invalidation failed (non-critical)', {
      module: 'Cache',
      label: 'CACHE_INVALIDATION_ERROR',
      extraData: {
        keys,
        patterns,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/**
 * Force re-cache data by invalidating and then fetching fresh data
 * This ensures the cache is refreshed with latest data
 * 
 * Usage:
 *   const freshData = await reCache(
 *     () => fetchFromDatabase(),
 *     { key: 'my-cache-key', duration: 'medium' }
 *   );
 */
export async function reCache<T>(
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const { key } = options;
  
  try {
    // First, invalidate the existing cache
    await cache.delete(key);
    logger.debug('Cache invalidated for re-caching', {
      module: 'Cache',
      label: 'CACHE_RECACHE_INVALIDATE',
      extraData: { key }
    });
    
    // Then fetch fresh data and cache it
    const data = await withCache(fetcher, options);
    
    logger.debug('Cache re-populated successfully', {
      module: 'Cache',
      label: 'CACHE_RECACHE_SUCCESS',
      extraData: { key }
    });
    
    return data;
  } catch (error) {
    logger.warning('Re-cache failed, falling back to direct fetch', {
      module: 'Cache',
      label: 'CACHE_RECACHE_ERROR',
      extraData: {
        key,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    // Fallback to direct fetch
    return fetcher();
  }
}

