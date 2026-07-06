import { Injectable, Logger } from '@nestjs/common';

/** TTL for token invalidation entries: 24 hours in milliseconds */
const TOKEN_INVALIDATION_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  /** Timestamp (ms) when invalidation was recorded */
  invalidatedAt: number;
  /** Timestamp (ms) when this cache entry expires */
  expiresAt: number;
}

/**
 * Service responsible for invalidating user tokens when
 * Teacher_School_Assignment changes occur.
 *
 * Uses in-memory Map cache with TTL 24h.
 * When Redis/CACHE_MANAGER is available in the future,
 * this can be swapped to use Redis with the same key pattern.
 *
 * Key pattern: token:invalid:{userId}
 *
 * Validates: Requirements 2.4
 */
@Injectable()
export class TokenInvalidationService {
  private readonly logger = new Logger(TokenInvalidationService.name);
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Invalidate all tokens issued before this moment for the given user.
   * Sets a marker with the current timestamp. Any JWT issued before
   * this timestamp is considered stale and should be rejected.
   *
   * @param userId - The user/teacher ID whose tokens should be invalidated
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    const key = `token:invalid:${userId}`;
    const now = Date.now();

    this.cache.set(key, {
      invalidatedAt: now,
      expiresAt: now + TOKEN_INVALIDATION_TTL_MS,
    });

    this.logger.debug(`Token invalidated for user ${userId} at ${now}`);
  }

  /**
   * Check if a token is still valid for the given user.
   * A token is valid if:
   * - No invalidation record exists for the user, OR
   * - The token was issued AFTER the invalidation timestamp
   *
   * @param userId - The user/teacher ID to check
   * @param tokenIssuedAt - The `iat` timestamp from the JWT (in milliseconds)
   * @returns true if the token is still valid, false if it's stale
   */
  async isTokenValid(userId: string, tokenIssuedAt: number): Promise<boolean> {
    const key = `token:invalid:${userId}`;

    const entry = this.cache.get(key);
    if (!entry) {
      return true;
    }

    // Clean up expired entries
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return true;
    }

    // Token is valid only if it was issued AFTER the invalidation
    return tokenIssuedAt > entry.invalidatedAt;
  }

  /**
   * Remove invalidation record for a user (e.g., after successful re-authentication).
   *
   * @param userId - The user/teacher ID to clear
   */
  async clearInvalidation(userId: string): Promise<void> {
    const key = `token:invalid:${userId}`;
    this.cache.delete(key);
    this.logger.debug(`Token invalidation cleared for user ${userId}`);
  }
}
