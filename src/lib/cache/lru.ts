import { LRUCache } from "lru-cache";

export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // milliseconds
}

export class LRUCacheManager<T extends {} = any> {
  private cache: LRUCache<string, T>;

  constructor(options: CacheOptions = {}) {
    this.cache = new LRUCache<string, T>({
      max: options.maxSize || 500,
      ttl: options.ttl || 10 * 60 * 1000, // 10 minutes default
    });
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, { ttl });
  }

  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }
}

// Global cache instances
export const sarCache = new LRUCacheManager<any>({
  maxSize: 100,
  ttl: 10 * 60 * 1000, // 10 minutes
});

export const nearbySearchCache = new LRUCacheManager<any>({
  maxSize: 1000,
  ttl: 10 * 60 * 1000, // 10 minutes
});

export const placeDetailsCache = new LRUCacheManager<any>({
  maxSize: 2000,
  ttl: 30 * 60 * 1000, // 30 minutes
});
