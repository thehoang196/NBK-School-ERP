import { Injectable, Logger } from '@nestjs/common';

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_LIST = 300; // 5 minutes
const DEFAULT_TTL_STATIC = 900; // 15 minutes

/**
 * CacheService — Abstraction layer cho cache operations.
 *
 * KHÔNG gọi Redis client trực tiếp từ service. Luôn sử dụng CacheService.
 *
 * Hiện tại: In-memory cache (Map) — fallback khi Redis chưa available.
 * Tương lai: Chuyển internal storage sang Redis (ioredis) mà không thay đổi API.
 *
 * TTL defaults:
 * - List queries: 5 phút (DEFAULT_TTL_LIST)
 * - Static data: 15 phút (DEFAULT_TTL_STATIC)
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();

  /**
   * Lấy giá trị từ cache.
   * @returns Giá trị cached hoặc null nếu không tồn tại/hết hạn.
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Lưu giá trị vào cache.
   * @param key Cache key
   * @param value Giá trị cần cache
   * @param options TTL options (default: 5 phút)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = (options?.ttl ?? DEFAULT_TTL_LIST) * 1000;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Lưu static data (TTL dài hơn — 15 phút).
   */
  async setStatic<T>(key: string, value: T): Promise<void> {
    return this.set(key, value, { ttl: DEFAULT_TTL_STATIC });
  }

  /**
   * Xoá key khỏi cache.
   */
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Xoá tất cả key matching pattern (prefix).
   * @param pattern Prefix pattern (vd: 'teachers:school-uuid-1')
   */
  async delByPattern(pattern: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Cache-aside pattern: lấy từ cache hoặc gọi factory nếu miss.
   * @param key Cache key
   * @param factory Function tạo giá trị nếu cache miss
   * @param options TTL options
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Flush toàn bộ cache (chỉ dùng cho testing/admin).
   */
  async flush(): Promise<void> {
    this.store.clear();
    this.logger.warn('Cache flushed');
  }

  /**
   * Số lượng entries hiện tại (cho health check/monitoring).
   */
  size(): number {
    return this.store.size;
  }
}
