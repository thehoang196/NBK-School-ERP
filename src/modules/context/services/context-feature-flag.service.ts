import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature flag service for the Context Switcher module.
 *
 * Controls whether the workspace context switcher feature is enabled
 * globally or per-school. When disabled, TenantMiddleware skips
 * context session resolution and uses JWT-only tenant resolution.
 *
 * Environment variables:
 * - CONTEXT_SWITCHER_ENABLED: "true" or "false" (default: "true")
 * - CONTEXT_SWITCHER_DISABLED_SCHOOLS: comma-separated list of school UUIDs to disable
 *
 * Validates: Requirements 18.1, 18.3
 */
@Injectable()
export class ContextFeatureFlagService {
  private readonly logger = new Logger(ContextFeatureFlagService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Checks whether the context switcher feature is globally enabled.
   *
   * Reads from env: CONTEXT_SWITCHER_ENABLED (defaults to "true").
   * When disabled, TenantMiddleware will skip Redis context session
   * resolution and fall back to JWT-only resolution.
   */
  isContextSwitcherEnabled(): boolean {
    const value = this.configService.get<string>(
      'CONTEXT_SWITCHER_ENABLED',
      'true',
    );
    return value.toLowerCase() === 'true';
  }

  /**
   * Checks whether the context switcher is enabled for a specific school.
   *
   * Reads from env: CONTEXT_SWITCHER_DISABLED_SCHOOLS (comma-separated UUIDs).
   * If the schoolId is in the disabled list, returns false (disabled for that school).
   * If the global flag is disabled, this also returns false regardless of the school.
   *
   * @param schoolId - The school UUID to check
   * @returns true if context switching is enabled for this school, false otherwise
   */
  isEnabledForSchool(schoolId: string): boolean {
    // If globally disabled, all schools are disabled
    if (!this.isContextSwitcherEnabled()) {
      return false;
    }

    // Check per-school disable list
    const disabledSchoolsRaw = this.configService.get<string>(
      'CONTEXT_SWITCHER_DISABLED_SCHOOLS',
      '',
    );

    if (!disabledSchoolsRaw || disabledSchoolsRaw.trim() === '') {
      return true;
    }

    const disabledSchools = disabledSchoolsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return !disabledSchools.includes(schoolId);
  }
}
