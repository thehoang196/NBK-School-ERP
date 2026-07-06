import * as fc from 'fast-check';
import { ExecutionContext } from '@nestjs/common';
import { SchoolScopeGuard } from '../../src/common/guards/school-scope.guard';
import { UserRole } from '../../src/common/enums/role.enum';
import { TokenInvalidationService } from '../../src/modules/auth/services/token-invalidation.service';

/**
 * Property-Based Tests for SchoolScopeGuard (v2 — Multi-School)
 *
 * Properties tested:
 * - Property 6: SchoolScopeGuard Multi-School Filtering
 * - Property 7: Unauthorized School Access Denial
 * - Property 22: Backward Compatibility — JWT Fallback
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 2.2, 2.5, 8.4**
 */

// --- Custom Arbitraries ---

/** Roles that are NOT SUPER_ADMIN (subject to schoolScope filtering) */
const nonSuperAdminRoles = [
  UserRole.SCHOOL_ADMIN,
  UserRole.SCHEDULER,
  UserRole.TEACHER,
  UserRole.VIEWER,
  UserRole.HR,
];

/** Generate a non-SUPER_ADMIN role */
const arbNonSuperAdminRole = fc.constantFrom(...nonSuperAdminRoles);

/** Generate a non-empty array of accessible school IDs (1–6 schools) */
const arbAccessibleSchoolIds = fc.uniqueArray(fc.uuid(), {
  minLength: 1,
  maxLength: 6,
});

// --- Typed Payloads ---

interface CrossSchoolJwtUser {
  id: string;
  userId: string;
  role: UserRole;
  schoolId: string;
  accessibleSchoolIds: string[];
}

interface LegacyJwtUser {
  id: string;
  userId: string;
  role: UserRole;
  schoolId: string;
}

/**
 * Generator: arbCrossSchoolJwtPayload
 * Generates a JWT user payload WITH accessibleSchoolIds (cross-school user).
 */
const arbCrossSchoolJwtPayload: fc.Arbitrary<CrossSchoolJwtUser> = fc
  .tuple(
    fc.uuid(), // userId
    arbNonSuperAdminRole,
    fc.uuid(), // schoolId (primary)
    arbAccessibleSchoolIds, // accessibleSchoolIds
  )
  .map(([userId, role, schoolId, accessibleSchoolIds]) => ({
    id: userId,
    userId,
    role,
    schoolId,
    accessibleSchoolIds,
  }));

/**
 * Generator: arbLegacyJwtPayload
 * Generates a JWT user payload WITHOUT accessibleSchoolIds (old-style JWT).
 */
const arbLegacyJwtPayload: fc.Arbitrary<LegacyJwtUser> = fc
  .tuple(
    fc.uuid(), // userId
    arbNonSuperAdminRole,
    fc.uuid(), // schoolId (primary)
  )
  .map(([userId, role, schoolId]) => ({
    id: userId,
    userId,
    role,
    schoolId,
  }));

/** Generate a JWT payload for SUPER_ADMIN */
const arbSuperAdminPayload = fc.uuid().map((userId) => ({
  id: userId,
  userId,
  role: UserRole.SUPER_ADMIN,
  schoolId: null as string | null,
  accessibleSchoolIds: undefined as string[] | undefined,
}));

// --- Test Helpers ---

/**
 * Build a mock ExecutionContext that exposes the request with a user.
 * Returns the request object for assertion after guard runs.
 */
function buildMockContext(user: object): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = { user };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

// --- Property Tests ---

describe('Feature: cross-campus-teaching | SchoolScopeGuard Property Tests', () => {
  let tokenInvalidationService: TokenInvalidationService;

  beforeEach(() => {
    tokenInvalidationService = new TokenInvalidationService();
  });

  /**
   * Property 6: SchoolScopeGuard Multi-School Filtering
   *
   * For any user with role TEACHER or SCHEDULER who has accessibleSchoolIds
   * in their JWT, the SchoolScopeGuard SHALL set request.schoolScope to the
   * full accessibleSchoolIds array (not a single schoolId).
   *
   * **Validates: Requirements 2.2**
   */
  describe('Property 6: SchoolScopeGuard Multi-School Filtering', () => {
    it('should set schoolScope to the full accessibleSchoolIds array for any user with cross-school JWT', async () => {
      await fc.assert(
        fc.asyncProperty(arbCrossSchoolJwtPayload, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          const result = await guard.canActivate(context);

          // Assert
          expect(result).toBe(true);
          // schoolScope MUST be the full accessibleSchoolIds array
          expect(request.schoolScope).toEqual(user.accessibleSchoolIds);
          // Must be an array (not a single string)
          expect(Array.isArray(request.schoolScope)).toBe(true);
          // Length must match
          expect((request.schoolScope as string[]).length).toBe(
            user.accessibleSchoolIds.length,
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve all school IDs without filtering or modification', async () => {
      await fc.assert(
        fc.asyncProperty(arbCrossSchoolJwtPayload, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          await guard.canActivate(context);

          // Assert: every school ID from JWT is present in schoolScope
          const schoolScope = request.schoolScope as string[];
          for (const schoolId of user.accessibleSchoolIds) {
            expect(schoolScope).toContain(schoolId);
          }
          // No extra IDs added
          for (const scopeId of schoolScope) {
            expect(user.accessibleSchoolIds).toContain(scopeId);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 7: Unauthorized School Access Denial
   *
   * For any user and for any school ID NOT present in their accessibleSchoolIds,
   * that school ID SHALL NOT be in request.schoolScope (access would be denied).
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 7: Unauthorized School Access Denial', () => {
    it('should never include a school ID not in accessibleSchoolIds in the schoolScope', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbCrossSchoolJwtPayload,
          fc.uuid(), // randomSchoolId — an arbitrary school not in the list
          async (user, randomSchoolId) => {
            // Pre-condition: the random school is NOT in the user's accessible list
            fc.pre(!user.accessibleSchoolIds.includes(randomSchoolId));

            // Arrange
            const guard = new SchoolScopeGuard(tokenInvalidationService);
            const { context, request } = buildMockContext(user);

            // Act
            await guard.canActivate(context);

            // Assert: the random school is NOT in the schoolScope
            const schoolScope = request.schoolScope as string[];
            expect(schoolScope).not.toContain(randomSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('schoolScope for non-SUPER_ADMIN is always a subset of accessibleSchoolIds', async () => {
      await fc.assert(
        fc.asyncProperty(arbCrossSchoolJwtPayload, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          await guard.canActivate(context);

          // Assert: schoolScope is exactly the accessibleSchoolIds — nothing more, nothing less
          const schoolScope = request.schoolScope as string[];
          const sortedScope = [...schoolScope].sort();
          const sortedExpected = [...user.accessibleSchoolIds].sort();
          expect(sortedScope).toEqual(sortedExpected);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 22: Backward Compatibility — JWT Fallback
   *
   * For any JWT without accessibleSchoolIds claim, the SchoolScopeGuard
   * SHALL fall back to schoolScope = [user.schoolId] (backward compat).
   *
   * **Validates: Requirements 8.4**
   */
  describe('Property 22: Backward Compatibility — JWT Fallback', () => {
    it('should fallback to [user.schoolId] when JWT has no accessibleSchoolIds', async () => {
      await fc.assert(
        fc.asyncProperty(arbLegacyJwtPayload, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          const result = await guard.canActivate(context);

          // Assert: falls back to single-school behavior
          expect(result).toBe(true);
          expect(request.schoolScope).toEqual([user.schoolId]);
        }),
        { numRuns: 100 },
      );
    });

    it('should set schoolScope to null when JWT has neither accessibleSchoolIds nor schoolId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          arbNonSuperAdminRole,
          async (userId, role) => {
            // Arrange: user with no accessibleSchoolIds and no schoolId
            const user = {
              id: userId,
              userId,
              role,
              schoolId: null as string | null,
              // No accessibleSchoolIds
            };
            const guard = new SchoolScopeGuard(tokenInvalidationService);
            const { context, request } = buildMockContext(user);

            // Act
            const result = await guard.canActivate(context);

            // Assert: when both are missing, schoolScope is null
            expect(result).toBe(true);
            expect(request.schoolScope).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('SUPER_ADMIN always gets schoolScope = null regardless of accessibleSchoolIds', async () => {
      await fc.assert(
        fc.asyncProperty(arbSuperAdminPayload, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          const result = await guard.canActivate(context);

          // Assert: SUPER_ADMIN always has null scope (full access)
          expect(result).toBe(true);
          expect(request.schoolScope).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('SUPER_ADMIN with accessibleSchoolIds still gets schoolScope = null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          arbAccessibleSchoolIds,
          async (userId, accessibleSchoolIds) => {
            // Arrange: SUPER_ADMIN with accessibleSchoolIds (edge case)
            const user = {
              id: userId,
              userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null as string | null,
              accessibleSchoolIds,
            };
            const guard = new SchoolScopeGuard(tokenInvalidationService);
            const { context, request } = buildMockContext(user);

            // Act
            const result = await guard.canActivate(context);

            // Assert: SUPER_ADMIN always has null scope (full access)
            expect(result).toBe(true);
            expect(request.schoolScope).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
