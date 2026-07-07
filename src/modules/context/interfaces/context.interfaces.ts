import { UserRole } from '../../../common/enums/role.enum';

/**
 * Context session stored in Redis.
 * Key pattern: context:session:{userId}
 */
export interface ContextSession {
  /** Active school UUID or "global" for SUPER_ADMIN Global View */
  schoolId: string;

  /** Unix timestamp (seconds) of last context switch */
  switchedAt: number;

  /** Version counter that increments on each context switch (starts at 1) */
  contextVersion: number;

  /** Unix timestamp (seconds) of last context resolution/access */
  lastAccessAt: number;
}

/**
 * DTO representing a school accessible to the user.
 */
export interface AccessibleSchoolDto {
  /** School UUID */
  id: string;

  /** School code (e.g. "TH01") */
  code: string;

  /** School name */
  name: string;

  /** Derived hierarchy level based on parentSchoolId and children */
  hierarchyLevel: 'holding' | 'company' | 'school';
}

/**
 * Response DTO for GET /api/v1/context/current
 */
export interface CurrentContextResponseDto {
  /** Active school UUID or null if no context established */
  activeSchoolId: string | null;

  /** Active school name or null */
  activeSchoolName: string | null;

  /** Active school code or null */
  activeSchoolCode: string | null;

  /** Whether Global View mode is active (SUPER_ADMIN only) */
  globalView: boolean;

  /** User's system-level role */
  role: UserRole;

  /** Whether the user can switch context (has 2+ accessible schools) */
  canSwitch: boolean;

  /** Whether context selection is required before accessing modules */
  contextRequired: boolean;
}

/**
 * Extended TenantStore interface for the context switcher.
 * Adds globalView flag to the existing TenantStore.
 */
export interface ExtendedTenantStore {
  /** The current school_id for tenant filtering, or null when in bypass mode */
  schoolId: string | null;

  /** Whether tenant filtering should be bypassed (Super Admin / system operations) */
  isBypass: boolean;

  /** The authenticated user's ID, or null for unauthenticated/system contexts */
  userId: string | null;

  /** Whether Global View mode is active (X-School-Id: "global") */
  globalView?: boolean;
}
