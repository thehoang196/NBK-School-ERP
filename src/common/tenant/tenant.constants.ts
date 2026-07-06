/**
 * Metadata key used by the @BypassTenantFilter() decorator to mark
 * handlers that should skip automatic tenant query filtering.
 */
export const BYPASS_TENANT_FILTER_KEY = 'BYPASS_TENANT_FILTER';

/**
 * Special marker token stored in the TenantStore to indicate that
 * the current context should bypass tenant filtering entirely.
 * Used by Super Admin without X-School-Id header and by system operations
 * (migrations, background jobs) that need cross-tenant access.
 */
export const TENANT_BYPASS_TOKEN = '__TENANT_BYPASS__';
