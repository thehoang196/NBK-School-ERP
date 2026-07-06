import { Injectable, Logger } from '@nestjs/common';

import { TenantContextService } from './tenant-context.service';

/**
 * Structured audit log entry for tenant-related events.
 */
export interface TenantAuditEntry {
  event: string;
  userId?: string | null;
  entityName?: string | null;
  endpoint?: string | null;
  method?: string | null;
  query?: string | null;
  sessionSchoolId?: string | null;
  superAdminId?: string | null;
  targetSchoolId?: string | null;
  timestamp: string;
}

/**
 * Service responsible for structured audit logging of tenant-related events.
 *
 * Logs three categories of events:
 * 1. TENANT_CONTEXT_MISSING — When TenantContextRequiredError is thrown
 * 2. RLS_VIOLATION — When PostgreSQL RLS policy denies access
 * 3. IMPERSONATION — When Super Admin activates impersonation context
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 */
@Injectable()
export class TenantAuditService {
  private readonly logger = new Logger(TenantAuditService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Logs a TenantContextRequiredError event with request metadata.
   * Called when a tenant-aware entity is accessed without an active tenant context.
   *
   * Validates: Requirement 8.1
   *
   * @param entityName - The entity being accessed
   * @param userId - The authenticated user's ID (if available)
   * @param endpoint - The request path/endpoint
   * @param method - The HTTP method (GET, POST, etc.)
   */
  logTenantContextError(
    entityName: string,
    userId?: string | null,
    endpoint?: string | null,
    method?: string | null,
  ): void {
    const entry: TenantAuditEntry = {
      event: 'TENANT_CONTEXT_MISSING',
      entityName,
      userId: userId ?? this.getCurrentUserId(),
      endpoint: endpoint ?? null,
      method: method ?? null,
      timestamp: new Date().toISOString(),
    };

    this.logger.error('Tenant context required', entry);
  }

  /**
   * Logs an RLS policy violation captured from PostgreSQL errors.
   * Called when the database denies access due to Row-Level Security policy.
   *
   * Validates: Requirement 8.2
   *
   * @param query - The sanitized query that was denied (sensitive data removed)
   * @param sessionSchoolId - The current session variable value
   * @param userId - The authenticated user's ID (if available)
   */
  logRlsViolation(
    query: string,
    sessionSchoolId: string | null,
    userId?: string | null,
  ): void {
    const entry: TenantAuditEntry = {
      event: 'RLS_VIOLATION',
      query: this.sanitizeQuery(query),
      sessionSchoolId,
      userId: userId ?? this.getCurrentUserId(),
      timestamp: new Date().toISOString(),
    };

    this.logger.error('RLS policy denied access', entry);
  }

  /**
   * Logs a Super Admin impersonation event.
   * Called when a Super Admin activates impersonation via X-School-Id header.
   *
   * Validates: Requirement 8.3
   *
   * @param superAdminId - The Super Admin's user ID
   * @param targetSchoolId - The school ID being impersonated
   */
  logImpersonation(superAdminId: string, targetSchoolId: string): void {
    const entry: TenantAuditEntry = {
      event: 'IMPERSONATION',
      superAdminId,
      targetSchoolId,
      timestamp: new Date().toISOString(),
    };

    this.logger.log('Super Admin impersonation activated', entry);
  }

  /**
   * Gets the current user ID from the tenant context if available.
   */
  private getCurrentUserId(): string | null {
    const store = this.tenantContext.getStore();
    return store?.userId ?? null;
  }

  /**
   * Sanitizes a SQL query for logging by removing sensitive values.
   * Replaces UUID-like parameter values and string literals with placeholders.
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '<UUID>',
      )
      .replace(/'[^']*'/g, "'<REDACTED>'");
  }
}
