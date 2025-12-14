export interface CacheItem<T = any> {
  value: T;
  ttl: number | null;
  setTime: number;
}

export interface CacheOptions {
  host?: string;
  port?: number;
  db?: number;
  defaultTTL?: number; // in seconds
}
