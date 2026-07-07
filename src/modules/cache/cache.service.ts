import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisConfig } from '../../config/redis.config';

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
}

const DEFAULT_TTL_LIST = 300; // 5 minutes
const DEFAULT_TTL_STATIC = 900; // 15 minutes

/**
 * CacheService — Abstraction layer cho cache operations.
 *
 * KHÔNG gọi Redis client trực tiếp từ service. Luôn sử dụng CacheService.
 *
 * Backend: Redis (ioredis). Nếu Redis không khả dụng, fallback về in-memory Map.
 *
 * TTL defaults:
 * - List queries: 5 phút (DEFAULT_TTL_LIST)
 * - Static data: 15 phút (DEFAULT_TTL_STATIC)
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private isRedisReady = false;

  /** Fallback in-memory store khi Redis không khả dụng */
  private readonly memoryStore = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(private readonly configService: ConfigService) {
    const redisConfig = getRedisConfig(this.configService);

    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 5) {
          this.logger.warn(
            'Redis retry limit reached, falling back to in-memory cache',
          );
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    this.redis.on('connect', () => {
      this.isRedisReady = true;
      this.logger.log('Redis connected successfully');
    });

    this.redis.on('error', (error: Error) => {
      this.isRedisReady = false;
      this.logger.warn(`Redis connection error: ${error.message}`);
    });

    this.redis.on('close', () => {
      this.isRedisReady = false;
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Lấy giá trị từ cache.
   * @returns Giá trị cached hoặc null nếu không tồn tại/hết hạn.
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisReady) {
      try {
        const value = await this.redis.get(key);
        if (value === null) {
          return null;
        }
        return JSON.parse(value) as T;
      } catch (error) {
        this.logger.warn(
          `Redis GET error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
        );
        return this.getFromMemory<T>(key);
      }
    }
    return this.getFromMemory<T>(key);
  }

  /**
   * Lưu giá trị vào cache.
   * @param key Cache key
   * @param value Giá trị cần cache
   * @param options TTL options (default: 5 phút)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? DEFAULT_TTL_LIST;
    const serialized = JSON.stringify(value);

    if (this.isRedisReady) {
      try {
        await this.redis.setex(key, ttl, serialized);
        return;
      } catch (error) {
        this.logger.warn(
          `Redis SET error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.setInMemory(key, serialized, ttl);
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
    if (this.isRedisReady) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        this.logger.warn(
          `Redis DEL error for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.memoryStore.delete(key);
  }

  /**
   * Xoá tất cả key matching pattern (prefix).
   * @param pattern Prefix pattern (vd: 'teachers:school-uuid-1')
   */
  async delByPattern(pattern: string): Promise<void> {
    if (this.isRedisReady) {
      try {
        const keys = await this.redis.keys(`${pattern}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      } catch (error) {
        this.logger.warn(
          `Redis DEL by pattern error for "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(pattern)) {
        this.memoryStore.delete(key);
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
    if (this.isRedisReady) {
      try {
        await this.redis.flushdb();
        this.logger.warn('Redis cache flushed');
        return;
      } catch (error) {
        this.logger.warn(
          `Redis FLUSH error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.memoryStore.clear();
    this.logger.warn('In-memory cache flushed');
  }

  /**
   * Số lượng entries hiện tại (cho health check/monitoring).
   */
  async size(): Promise<number> {
    if (this.isRedisReady) {
      try {
        return await this.redis.dbsize();
      } catch {
        return this.memoryStore.size;
      }
    }
    return this.memoryStore.size;
  }

  /**
   * Check Redis connection status.
   */
  isConnected(): boolean {
    return this.isRedisReady;
  }

  // ─── Private: In-memory fallback ─────────────────────────────────────

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryStore.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  private setInMemory(key: string, serialized: string, ttlSeconds: number): void {
    this.memoryStore.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
