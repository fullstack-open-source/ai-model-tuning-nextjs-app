/* eslint-disable @typescript-eslint/no-explicit-any */
import { CacheItem, CacheOptions } from '../../types/cache';
import { redisConfig } from '@lib/config/env';

// Client-safe logging helper (only uses console, no Node modules)
const log = {
  warning: (message: string) => {
    // Only log warnings in development
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(`[Cache] ${message}`);
    }
  },
  success: (message: string) => {
    // Only log success in development
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[Cache] ${message}`);
    }
  },
};

export type CacheDuration = 'short' | 'medium' | 'long' | 'very_long';

export const CacheTTL: Record<CacheDuration, number> = {
  short: redisConfig.shortTTL,
  medium: redisConfig.mediumTTL,
  long: redisConfig.longTTL,
  very_long: redisConfig.veryLongTTL,
};

/**
 * Serialize data for caching (handles BigInt, Date, and other non-serializable types)
 * Converts BigInt to string to avoid JSON.stringify errors
 */
function serializeForCache<T>(data: T): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle BigInt - convert to string
  if (typeof data === 'bigint') {
    return data.toString();
  }

  // Handle Date - convert to ISO string
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle arrays - recursively serialize each element
  if (Array.isArray(data)) {
    return data.map(item => serializeForCache(item));
  }

  // Handle objects - recursively serialize each property
  if (data && typeof data === 'object') {
    // Check if object has a toJSON method (e.g., Prisma models)
    if (typeof (data as any).toJSON === 'function') {
      return serializeForCache((data as any).toJSON());
    }

    // Handle Map
    if (data instanceof Map) {
      return Array.from(data.entries()).map(([k, v]) => [serializeForCache(k), serializeForCache(v)]);
    }

    // Handle Set
    if (data instanceof Set) {
      return Array.from(data).map(item => serializeForCache(item));
    }

    // Handle plain objects
    const serialized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip functions and symbols
      if (typeof value === 'function' || typeof value === 'symbol') {
        continue;
      }
      serialized[key] = serializeForCache(value);
    }
    return serialized;
  }

  // Return primitive values as-is
  return data;
}

export class HybridCache {
  private static instance: HybridCache;
  // Use a minimal type to avoid bringing ioredis types into the client bundle
  private redisClient: {
    get: (k: string) => Promise<string | null>
    set: (...args: any[]) => Promise<any>
    del: (k: string) => Promise<any>
    flushdb: () => Promise<any>
    ping: () => Promise<string>
    keys?: (pattern: string) => Promise<string[]>
    scan?: (cursor: string, ...args: any[]) => Promise<[string, string[]]>
  } | null = null;
  private useRedis: boolean = false;
  private localCache: Record<string, CacheItem> = {};
  private defaultTTL: number;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  private constructor(options?: CacheOptions) {
    const host = options?.host || redisConfig.host;
    const port = options?.port || redisConfig.port;
    const db = options?.db || redisConfig.db;
    this.defaultTTL = options?.defaultTTL || redisConfig.defaultTTL;

    // Only attempt to create a Redis client on the server AND if Redis is enabled.
    if (typeof window === 'undefined' && redisConfig.enabled) {
      // Lazy-load ioredis on the server only to avoid bundling Node built-ins into the browser.
      // We don't await here; until the client is ready, cache falls back to in-memory.
      void import('ioredis')
        .then(({ default: Redis }) => {
          this.redisClient = new Redis({ host, port, db }) as any;
        })
        .catch((error) => {
          log.warning(`Redis client initialization failed: ${String(error)}`);
          this.redisClient = null;
        });
    }
  }

  public static getInstance(options?: CacheOptions) {
    if (!HybridCache.instance) {
      HybridCache.instance = new HybridCache(options);
    }
    return HybridCache.instance;
  }

  public async init() {
    // If already initialized, return immediately
    if (this.initialized) return;
    
    // If initialization is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    // Start initialization
    this.initPromise = this._doInit();
    await this.initPromise;
  }

  private async _doInit() {
    if (!this.redisClient) {
      this.initialized = true;
      return;
    }
    
    try {
      await this.redisClient.ping();
      this.useRedis = true;
      this.initialized = true;
      log.success('Redis available and connected.');
    } catch (error) {
      this.useRedis = false;
      this.initialized = true;
      log.warning(`Redis not available, falling back to in-memory cache: ${String(error)}`);
    }
  }

  /**
   * Ensure cache is initialized before use
   * This is called automatically by cache operations
   */
  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  public async set<T>(key: string, value: T, ttl?: number) {
    await this.ensureInitialized();
    ttl = ttl || this.defaultTTL;
    if (this.useRedis && this.redisClient) {
      try {
        // Serialize data to handle BigInt, Date, and other non-serializable types
        const serialized = serializeForCache(value);
        await this.redisClient.set(key, JSON.stringify(serialized), 'EX', ttl);
        return;
      } catch (error) {
        log.warning(`Redis set failed: ${String(error)}`);
        this.useRedis = false;
        // Fall through to in-memory cache with serialized value
      }
    }
    // In-memory fallback - also serialize for consistency
    const serialized = serializeForCache(value);
    this.localCache[key] = { value: serialized, ttl, setTime: Date.now() };
  }

  public async get<T = any>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    if (this.useRedis && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? (JSON.parse(val) as T) : null;
      } catch (error) {
        log.warning(`Redis get failed: ${String(error)}`);
        this.useRedis = false;
        return this.get<T>(key);
      }
    }
    const item = this.localCache[key];
    if (!item) return null;
    if (item.ttl !== null && Date.now() - item.setTime > item.ttl * 1000) {
      await this.delete(key);
      return null;
    }
    return item.value as T;
  }

  /**
   * Get value from cache or compute it using the provided fetcher.
   * Does NOT delete keys on cache miss; it simply populates them.
   */
  public async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    duration: CacheDuration = 'medium'
  ): Promise<T> {
    await this.ensureInitialized();
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const data = await fetcher();
    const ttl = CacheTTL[duration] ?? this.defaultTTL;
    await this.set<T>(key, data, ttl);
    
    // Verify the cache was set correctly
    const verify = await this.get<T>(key);
    if (verify === null || verify === undefined) {
      log.warning(`Cache verification failed for key: ${key}`);
    }
    
    return data;
  }

  /**
   * Verify that a key exists in cache
   */
  public async exists(key: string): Promise<boolean> {
    await this.ensureInitialized();
    if (this.useRedis && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val !== null;
      } catch (error) {
        log.warning(`Redis exists check failed: ${String(error)}`);
        this.useRedis = false;
        return this.exists(key);
      }
    }
    return key in this.localCache;
  }

  public async delete(key: string) {
    await this.ensureInitialized();
    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (error) {
        log.warning(`Redis delete failed: ${String(error)}`);
        this.useRedis = false;
        await this.delete(key);
      }
    } else {
      delete this.localCache[key];
    }
  }

  public async clear() {
    await this.ensureInitialized();
    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.flushdb();
        return;
      } catch (error) {
        log.warning(`Redis flush failed: ${String(error)}`);
        this.useRedis = false;
        await this.clear();
      }
    } else {
      this.localCache = {};
    }
  }

  /**
   * Delete all keys matching a pattern
   * Uses Redis SCAN for safe pattern matching (doesn't block Redis)
   */
  public async deleteByPattern(pattern: string): Promise<number> {
    await this.ensureInitialized();
    if (!this.useRedis || !this.redisClient) {
      // For local cache, delete matching keys
      let deletedCount = 0;
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const key in this.localCache) {
        if (regex.test(key)) {
          delete this.localCache[key];
          deletedCount++;
        }
      }
      return deletedCount;
    }

    try {
      // Use Redis SCAN to find matching keys
      const client = this.redisClient as any;
      if (client.scan) {
        let cursor = '0';
        let deletedCount = 0;
        const keysToDelete: string[] = [];

        do {
          const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys && keys.length > 0) {
            keysToDelete.push(...keys);
          }
        } while (cursor !== '0');

        // Delete all matching keys in batches
        if (keysToDelete.length > 0) {
          // Delete in chunks to avoid blocking
          const chunkSize = 100;
          for (let i = 0; i < keysToDelete.length; i += chunkSize) {
            const chunk = keysToDelete.slice(i, i + chunkSize);
            await Promise.all(chunk.map(key => this.delete(key)));
            deletedCount += chunk.length;
          }
        }
        return deletedCount;
      } else if (client.keys) {
        // Fallback to KEYS (not recommended for production, but works)
        const keys = await client.keys(pattern);
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((key: string) => this.delete(key)));
          return keys.length;
        }
        return 0;
      }
      return 0;
    } catch (error) {
      log.warning(`Redis pattern delete failed: ${String(error)}`);
      return 0;
    }
  }
}

// Singleton instance
export const cache = HybridCache.getInstance();
