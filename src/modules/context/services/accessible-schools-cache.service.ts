import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

/**
 * AccessibleSchoolsCacheService — Optional caching layer for accessible school IDs.
 *
 * IMPORTANT: The ContextService.computeAccessibleSchoolIds() does NOT use this cache.
 * It always queries the DB for real-time accuracy (Requirement 4.7).
 * This cache is an OPTIONAL optimization layer that consumers can use when
 * 5-second staleness is acceptable (e.g., non-critical reads, middleware validation).
 *
 * Key pattern: accessible-schools:{userId}
 * TTL: 5 minutes (300 seconds)
 *
 * Resilience rules:
 * - All cache operations wrapped in try-catch
 * - On cache failure: log warning and return null (don't throw)
 * - Uses CacheService abstraction, NOT raw Redis client
 *
 * Invalidation triggers:
 * - School assignment changes
 * - Role changes
 * - WorkspaceChangedEvent (via task 15.3 subscriber)
 */
@Injectable()
export class AccessibleSchoolsCacheService {
  private readonly logger = new Logger(AccessibleSchoolsCacheService.name);

  /** 5 minutes in seconds */
  private readonly CACHE_TTL = 300;

  /** Cache key prefix for accessible schools */
  private readonly KEY_PREFIX = 'accessible-schools:';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get cached accessible school IDs for a user.
   *
   * @param userId - The user's UUID
   * @returns Cached array of school IDs, or null if cache miss/error
   */
  async getCachedSchoolIds(userId: string): Promise<string[] | null> {
    const key = this.buildKey(userId);

    try {
      const cached = await this.cacheService.get<string[]>(key);
      return cached;
    } catch (error) {
      this.logger.warn(
        `Failed to get cached accessible schools for user ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Cache accessible school IDs for a user with TTL 5min (300 seconds).
   *
   * @param userId - The user's UUID
   * @param schoolIds - Array of accessible school UUIDs
   */
  async setCachedSchoolIds(
    userId: string,
    schoolIds: string[],
  ): Promise<void> {
    const key = this.buildKey(userId);

    try {
      await this.cacheService.set<string[]>(key, schoolIds, {
        ttl: this.CACHE_TTL,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to cache accessible schools for user ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Invalidate cached accessible schools for a specific user.
   * Called on school assignment changes, role changes, or context switch.
   *
   * @param userId - The user's UUID
   */
  async invalidateForUser(userId: string): Promise<void> {
    const key = this.buildKey(userId);

    try {
      await this.cacheService.del(key);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate accessible schools cache for user ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Invalidate all accessible schools caches (on bulk changes).
   * Uses pattern-based deletion to clear all keys with the accessible-schools prefix.
   */
  async invalidateAll(): Promise<void> {
    try {
      await this.cacheService.delByPattern(this.KEY_PREFIX);
    } catch (error) {
      this.logger.warn(
        'Failed to invalidate all accessible schools caches',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Build the cache key for a user's accessible schools.
   */
  private buildKey(userId: string): string {
    return `${this.KEY_PREFIX}${userId}`;
  }
}
