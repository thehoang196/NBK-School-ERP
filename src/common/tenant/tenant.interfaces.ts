/**
 * Represents the tenant context stored in AsyncLocalStorage
 * for the duration of a request or operation lifecycle.
 */
export interface TenantStore {
  /** The current school_id for tenant filtering, or null when in bypass mode */
  schoolId: string | null;

  /** Whether tenant filtering should be bypassed (Super Admin / system operations) */
  isBypass: boolean;

  /** The authenticated user's ID, or null for unauthenticated/system contexts */
  userId: string | null;
}
