import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagRepository } from './feature-flag.repository';

/** TTL for feature flag cache entries in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly cache = new Map<string, CacheEntry<boolean>>();

  constructor(private readonly featureFlagRepository: FeatureFlagRepository) {}

  /**
   * Check if cross-school feature is enabled for a given organization.
   * Uses in-memory cache with TTL 5 minutes, fallback to DB query.
   *
   * Cache key pattern: feature:cross_school:{orgId}
   */
  async isCrossSchoolEnabled(organizationId: string): Promise<boolean> {
    const cacheKey = `feature:cross_school:${organizationId}`;

    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const enabled = await this.queryFeatureFlag(
      'CROSS_SCHOOL_ENABLED',
      organizationId,
    );

    this.setCache(cacheKey, enabled);
    return enabled;
  }

  /**
   * Invalidate cached feature flag for an organization.
   * Call this when the flag value is updated.
   */
  invalidateCache(organizationId: string): void {
    const cacheKey = `feature:cross_school:${organizationId}`;
    this.cache.delete(cacheKey);
    this.logger.debug(`Cache invalidated for key: ${cacheKey}`);
  }

  private getFromCache(key: string): boolean | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCache(key: string, value: boolean): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  private async queryFeatureFlag(
    flagKey: string,
    organizationId: string,
  ): Promise<boolean> {
    const flag = await this.featureFlagRepository.findByOrgAndKey(
      organizationId,
      flagKey,
    );
    return flag?.enabled ?? false;
  }
}
