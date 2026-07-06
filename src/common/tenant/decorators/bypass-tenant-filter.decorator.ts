import { SetMetadata } from '@nestjs/common';
import { BYPASS_TENANT_FILTER_KEY } from '../tenant.constants';

/**
 * Decorator to mark a handler as bypassing automatic tenant query filtering.
 * Use on controller methods or classes that need cross-tenant access
 * (e.g., Super Admin endpoints, system-level operations).
 */
export const BypassTenantFilter = () =>
  SetMetadata(BYPASS_TENANT_FILTER_KEY, true);
