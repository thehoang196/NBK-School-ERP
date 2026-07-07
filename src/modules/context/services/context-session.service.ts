import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { ContextSession } from '../interfaces/context.interfaces';

/**
 * ContextSessionService — Manages Redis-backed workspace context sessions.
 *
 * Stores the user's active school context in cache with 24h TTL.
 * Key pattern: context:session:{userId}
 *
 * Resilience rules:
 * - All Redis operations wrapped in try-catch
 * - On connection failure (>500ms timeout): silently return null, no error to client
 * - Uses CacheService abstraction, NOT raw Redis client
 */
@Injectable()
export class ContextSessionService {
  private readonly logger = new Logger(ContextSessionService.name);

  /** 24 hours in seconds */
  private readonly SESSION_TTL = 86400;

  /** Cache key prefix for context sessions */
  private readonly KEY_PREFIX = 'context:session:';

  /** Maximum time to wait for a cache operation (ms) */
  private readonly OPERATION_TIMEOUT_MS = 500;

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Store active context for a user.
   * Stores JSON { schoolId, switchedAt, contextVersion, lastAccessAt } with 24h TTL.
   * Reads the current session to increment contextVersion (starts at 1 if no prior session).
   *
   * @param userId - The user's UUID
   * @param schoolId - The target school UUID
   */
  async setActiveContext(userId: string, schoolId: string): Promise<void> {
    const key = this.buildKey(userId);
    const now = Math.floor(Date.now() / 1000);

    try {
      // Read current session to get existing contextVersion
      const currentSession = await this.withTimeout(
        this.cacheService.get<ContextSession>(key),
      );

      const currentVersion = currentSession?.contextVersion ?? 0;

      const session: ContextSession = {
        schoolId,
        switchedAt: now,
        contextVersion: currentVersion + 1,
        lastAccessAt: now,
      };

      await this.withTimeout(
        this.cacheService.set<ContextSession>(key, session, {
          ttl: this.SESSION_TTL,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to set active context for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Get active context for a user.
   * Returns the schoolId or null if expired/missing/error.
   * Updates lastAccessAt to current timestamp on each read.
   *
   * On Redis connection failure (>500ms timeout): silently returns null.
   *
   * @param userId - The user's UUID
   * @returns The active schoolId or null
   */
  async getActiveContext(userId: string): Promise<string | null> {
    const key = this.buildKey(userId);

    try {
      const session = await this.withTimeout(
        this.cacheService.get<ContextSession>(key),
      );

      if (!session) {
        return null;
      }

      // Update lastAccessAt on each read and re-store with same TTL
      const updatedSession: ContextSession = {
        ...session,
        lastAccessAt: Math.floor(Date.now() / 1000),
      };

      await this.withTimeout(
        this.cacheService.set<ContextSession>(key, updatedSession, {
          ttl: this.SESSION_TTL,
        }),
      );

      return session.schoolId;
    } catch (error) {
      this.logger.warn(
        `Failed to get active context for user ${userId}, falling back to null`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Delete context session for a user (logout/invalidation).
   *
   * @param userId - The user's UUID
   */
  async deleteSession(userId: string): Promise<void> {
    const key = this.buildKey(userId);

    try {
      await this.withTimeout(this.cacheService.del(key));
    } catch (error) {
      this.logger.error(
        `Failed to delete context session for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Refresh TTL to 24h on access.
   * Re-stores the existing session with a fresh TTL and updates lastAccessAt.
   *
   * @param userId - The user's UUID
   */
  async refreshTtl(userId: string): Promise<void> {
    const key = this.buildKey(userId);

    try {
      const session = await this.withTimeout(
        this.cacheService.get<ContextSession>(key),
      );

      if (session) {
        const updatedSession: ContextSession = {
          ...session,
          lastAccessAt: Math.floor(Date.now() / 1000),
        };

        await this.withTimeout(
          this.cacheService.set<ContextSession>(key, updatedSession, {
            ttl: this.SESSION_TTL,
          }),
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to refresh TTL for user ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Build the cache key for a user's context session.
   */
  private buildKey(userId: string): string {
    return `${this.KEY_PREFIX}${userId}`;
  }

  /**
   * Wrap a promise with a timeout to ensure operations complete within 500ms.
   * On timeout, rejects with a timeout error (caught by caller's try-catch).
   */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Cache operation timed out'));
      }, this.OPERATION_TIMEOUT_MS);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
