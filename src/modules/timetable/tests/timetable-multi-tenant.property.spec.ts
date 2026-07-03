/**
 * Feature: timetable-management-features, Property 15: Multi-tenant data isolation
 *
 * **Validates: Requirements 5.3, 5.4, 5.7**
 *
 * Property: For any user with role other than SUPER_ADMIN, all TKB operations
 * SHALL be restricted to data within the user's assigned school_id.
 * A SUPER_ADMIN SHALL access data across all schools without restriction.
 */
import * as fc from 'fast-check';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { UserRole } from '../../../common/enums/role.enum';

describe('Feature: timetable-management-features, Property 15: Multi-tenant data isolation', () => {
  let guard: SchoolScopeGuard;

  // Arbitrary: valid UUID v4
  const uuidArb = fc.uuid();

  // Arbitrary: non-SUPER_ADMIN roles (school-scoped roles)
  const schoolScopedRoleArb = fc.constantFrom(
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
    UserRole.VIEWER,
  );

  // Arbitrary: any role (including SUPER_ADMIN)
  const anyRoleArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
    UserRole.VIEWER,
  );

  /**
   * Helper: create a mock ExecutionContext with user info
   */
  function createMockContext(user: { id: string; role: UserRole; schoolId: string | null }): {
    context: ExecutionContext;
    request: Record<string, unknown>;
  } {
    const request: Record<string, unknown> = { user };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  beforeEach(() => {
    guard = new SchoolScopeGuard();
  });

  it('should set schoolScope to user schoolId for ALL non-SUPER_ADMIN roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        schoolScopedRoleArb,
        uuidArb,
        async (userId: string, role: UserRole, schoolId: string) => {
          const user = { id: userId, role, schoolId };
          const { context, request } = createMockContext(user);

          const result = guard.canActivate(context);

          // Guard should allow the request
          expect(result).toBe(true);

          // schoolScope should be set to the user's schoolId (not null)
          expect(request.schoolScope).toBe(schoolId);
          expect(request.schoolScope).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should set schoolScope to null for SUPER_ADMIN (unrestricted access)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.option(uuidArb, { nil: null }),
        async (userId: string, schoolId: string | null) => {
          const user = { id: userId, role: UserRole.SUPER_ADMIN, schoolId };
          const { context, request } = createMockContext(user);

          const result = guard.canActivate(context);

          // Guard should allow the request
          expect(result).toBe(true);

          // schoolScope should be null (no restriction)
          expect(request.schoolScope).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should enforce that non-SUPER_ADMIN users NEVER get null schoolScope', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        schoolScopedRoleArb,
        uuidArb,
        async (userId: string, role: UserRole, schoolId: string) => {
          const user = { id: userId, role, schoolId };
          const { context, request } = createMockContext(user);

          guard.canActivate(context);

          // CRITICAL: schoolScope must NEVER be null for non-SUPER_ADMIN
          // This ensures data isolation is enforced at every request
          expect(request.schoolScope).not.toBeNull();
          expect(request.schoolScope).not.toBeUndefined();
          expect(typeof request.schoolScope).toBe('string');
          expect((request.schoolScope as string).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should ensure schoolScope matches EXACTLY the user schoolId (no cross-tenant leakage)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        schoolScopedRoleArb,
        uuidArb,
        uuidArb,
        async (userId: string, role: UserRole, userSchoolId: string, otherSchoolId: string) => {
          // Ensure the two school IDs are different
          fc.pre(userSchoolId !== otherSchoolId);

          const user = { id: userId, role, schoolId: userSchoolId };
          const { context, request } = createMockContext(user);

          guard.canActivate(context);

          // schoolScope must be the user's own school, never the other school
          expect(request.schoolScope).toBe(userSchoolId);
          expect(request.schoolScope).not.toBe(otherSchoolId);
        },
      ),
      { numRuns: 100 },
    );
  });

  describe('Service-level data isolation via schoolId filtering', () => {
    /**
     * Simulates how TimetableVersionService.findAll filters by schoolId
     * via the query object scoped by the controller.
     *
     * This verifies that when a service receives a schoolScope,
     * it only returns versions belonging to that school.
     */

    interface MockVersion {
      id: string;
      schoolId: string;
      name: string;
      versionNumber: number;
    }

    // Arbitrary: generate a random version belonging to a specific school
    const versionForSchoolArb = (schoolId: string): fc.Arbitrary<MockVersion> =>
      fc.record({
        id: fc.uuid(),
        schoolId: fc.constant(schoolId),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        versionNumber: fc.integer({ min: 1, max: 100 }),
      });

    // Simulate service-level filtering by schoolId
    function filterVersionsBySchool(
      versions: MockVersion[],
      schoolScope: string | null,
    ): MockVersion[] {
      if (schoolScope === null) {
        // SUPER_ADMIN: return all versions
        return versions;
      }
      // Non-SUPER_ADMIN: return only versions matching school
      return versions.filter((v) => v.schoolId === schoolScope);
    }

    it('non-SUPER_ADMIN should only see versions from their own school', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          schoolScopedRoleArb,
          async (
            userSchoolId: string,
            otherSchoolId: string,
            versionIds: string[],
            role: UserRole,
          ) => {
            fc.pre(userSchoolId !== otherSchoolId);

            // Create versions: some from user's school, some from other school
            const userVersions: MockVersion[] = versionIds.map((id, i) => ({
              id,
              schoolId: userSchoolId,
              name: `Version ${i}`,
              versionNumber: i + 1,
            }));
            const otherVersions: MockVersion[] = versionIds.map((id, i) => ({
              id: `other-${id}`,
              schoolId: otherSchoolId,
              name: `Other Version ${i}`,
              versionNumber: i + 1,
            }));
            const allVersions = [...userVersions, ...otherVersions];

            // Simulate guard setting schoolScope
            const user = { id: 'user-1', role, schoolId: userSchoolId };
            const { context, request } = createMockContext(user);
            guard.canActivate(context);

            // Filter as service would do
            const result = filterVersionsBySchool(
              allVersions,
              request.schoolScope as string | null,
            );

            // User should ONLY see their own school's versions
            expect(result).toHaveLength(userVersions.length);
            for (const version of result) {
              expect(version.schoolId).toBe(userSchoolId);
              expect(version.schoolId).not.toBe(otherSchoolId);
            }

            // None of the other school's versions should leak through
            const leakedVersions = result.filter((v) => v.schoolId === otherSchoolId);
            expect(leakedVersions).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('SUPER_ADMIN should see versions from ALL schools', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          async (
            schoolA: string,
            schoolB: string,
            countA: number,
            countB: number,
          ) => {
            fc.pre(schoolA !== schoolB);

            // Create versions from two different schools
            const versionsA: MockVersion[] = Array.from({ length: countA }, (_, i) => ({
              id: `a-${i}-${schoolA.slice(0, 8)}`,
              schoolId: schoolA,
              name: `School A Version ${i}`,
              versionNumber: i + 1,
            }));
            const versionsB: MockVersion[] = Array.from({ length: countB }, (_, i) => ({
              id: `b-${i}-${schoolB.slice(0, 8)}`,
              schoolId: schoolB,
              name: `School B Version ${i}`,
              versionNumber: i + 1,
            }));
            const allVersions = [...versionsA, ...versionsB];

            // Simulate guard setting schoolScope for SUPER_ADMIN
            const user = { id: 'superadmin-1', role: UserRole.SUPER_ADMIN, schoolId: null };
            const { context, request } = createMockContext(user);
            guard.canActivate(context);

            // Filter as service would do
            const result = filterVersionsBySchool(
              allVersions,
              request.schoolScope as string | null,
            );

            // SUPER_ADMIN should see ALL versions from all schools
            expect(result).toHaveLength(allVersions.length);
            expect(result).toHaveLength(countA + countB);

            // Verify both schools' versions are present
            const schoolAVersions = result.filter((v) => v.schoolId === schoolA);
            const schoolBVersions = result.filter((v) => v.schoolId === schoolB);
            expect(schoolAVersions).toHaveLength(countA);
            expect(schoolBVersions).toHaveLength(countB);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('cross-school access attempt should yield empty results for non-SUPER_ADMIN', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          schoolScopedRoleArb,
          fc.integer({ min: 1, max: 10 }),
          async (
            userSchoolId: string,
            targetSchoolId: string,
            role: UserRole,
            versionCount: number,
          ) => {
            fc.pre(userSchoolId !== targetSchoolId);

            // Create versions that ONLY belong to a different school
            const targetVersions: MockVersion[] = Array.from({ length: versionCount }, (_, i) => ({
              id: `target-${i}-${targetSchoolId.slice(0, 8)}`,
              schoolId: targetSchoolId,
              name: `Target Version ${i}`,
              versionNumber: i + 1,
            }));

            // Simulate guard setting schoolScope for non-SUPER_ADMIN user
            const user = { id: 'user-1', role, schoolId: userSchoolId };
            const { context, request } = createMockContext(user);
            guard.canActivate(context);

            // Filter as service would do — user trying to access another school's data
            const result = filterVersionsBySchool(
              targetVersions,
              request.schoolScope as string | null,
            );

            // Should get ZERO results because all versions belong to another school
            expect(result).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
