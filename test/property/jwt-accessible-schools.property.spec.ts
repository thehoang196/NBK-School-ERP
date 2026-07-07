import * as fc from 'fast-check';
import { AuthService, JwtPayload } from '../../src/modules/auth/auth.service';
import { UserEntity } from '../../src/modules/auth/entities/user.entity';
import { UserRole } from '../../src/common/enums/role.enum';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentEntity } from '../../src/modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';

/**
 * Property 5: JWT Accessible Schools Completeness
 *
 * For any teacher with N active Teacher_School_Assignments (1 primary + M secondary),
 * the JWT accessibleSchoolIds claim SHALL contain exactly N school IDs corresponding
 * to those assignments.
 *
 * **Validates: Requirements 2.1**
 */

// --- Types ---

interface AssignmentData {
  id: string;
  teacherId: string;
  schoolId: string;
  role: AssignmentRole;
  status: AssignmentStatus;
}

// --- Generators ---

/**
 * Generate a list of active assignments for a teacher:
 * - Exactly 1 PRIMARY assignment
 * - Between 0 and 5 SECONDARY assignments
 * Total N is between 1 and 6.
 */
const arbActiveAssignments = fc
  .integer({ min: 0, max: 5 })
  .chain((secondaryCount) =>
    fc.tuple(
      fc.uuid(), // teacherId
      fc.uuid(), // primary schoolId
      fc.uniqueArray(fc.uuid(), {
        minLength: secondaryCount,
        maxLength: secondaryCount,
      }),
    ),
  )
  .map(([teacherId, primarySchoolId, secondarySchoolIds]) => {
    const assignments: AssignmentData[] = [];

    // Primary assignment
    assignments.push({
      id: `prim-${primarySchoolId.slice(0, 8)}`,
      teacherId,
      schoolId: primarySchoolId,
      role: AssignmentRole.PRIMARY,
      status: AssignmentStatus.ACTIVE,
    });

    // Secondary assignments
    for (const schoolId of secondarySchoolIds) {
      assignments.push({
        id: `sec-${schoolId.slice(0, 8)}`,
        teacherId,
        schoolId,
        role: AssignmentRole.SECONDARY,
        status: AssignmentStatus.ACTIVE,
      });
    }

    return { teacherId, primarySchoolId, assignments };
  });

/**
 * Generate a scenario with a mix of active and inactive assignments.
 * Only active assignments should appear in the JWT.
 */
const arbMixedAssignments = fc
  .tuple(
    fc.integer({ min: 1, max: 5 }), // activeSecondaryCount
    fc.integer({ min: 0, max: 3 }), // inactiveSecondaryCount
  )
  .chain(([activeCount, inactiveCount]) =>
    fc.tuple(
      fc.uuid(), // teacherId
      fc.uuid(), // primary schoolId
      fc.uniqueArray(fc.uuid(), {
        minLength: activeCount + inactiveCount,
        maxLength: activeCount + inactiveCount,
      }),
      fc.constant(activeCount),
    ),
  )
  .map(([teacherId, primarySchoolId, allSecondarySchoolIds, activeCount]) => {
    const assignments: AssignmentData[] = [];

    // Primary assignment (always active)
    assignments.push({
      id: `prim-${primarySchoolId.slice(0, 8)}`,
      teacherId,
      schoolId: primarySchoolId,
      role: AssignmentRole.PRIMARY,
      status: AssignmentStatus.ACTIVE,
    });

    // Active secondary assignments
    for (let i = 0; i < activeCount; i++) {
      assignments.push({
        id: `sec-active-${i}`,
        teacherId,
        schoolId: allSecondarySchoolIds[i],
        role: AssignmentRole.SECONDARY,
        status: AssignmentStatus.ACTIVE,
      });
    }

    // Inactive secondary assignments
    for (let i = activeCount; i < allSecondarySchoolIds.length; i++) {
      assignments.push({
        id: `sec-inactive-${i}`,
        teacherId,
        schoolId: allSecondarySchoolIds[i],
        role: AssignmentRole.SECONDARY,
        status: AssignmentStatus.INACTIVE,
      });
    }

    const activeAssignments = assignments.filter(
      (a) => a.status === AssignmentStatus.ACTIVE,
    );
    const expectedSchoolIds = activeAssignments.map((a) => a.schoolId);

    return {
      teacherId,
      primarySchoolId,
      assignments,
      activeAssignments,
      expectedSchoolIds,
    };
  });

// --- Mock Builders ---

function buildMockJwtService() {
  return {
    sign: jest.fn((payload: JwtPayload) => {
      // Return a fake token that encodes the payload for inspection
      return JSON.stringify(payload);
    }),
  };
}

function buildMockUserRepository() {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };
}

function buildMockTeacherSchoolAssignmentService(
  activeAssignments: AssignmentData[],
): Partial<TeacherSchoolAssignmentService> {
  return {
    getAccessibleSchoolIds: jest.fn(async (_teacherId: string) => {
      // Return school IDs of active assignments only
      return activeAssignments.map((a) => a.schoolId);
    }),
  };
}

function buildTeacherUser(teacherId: string, schoolId: string): UserEntity {
  return {
    id: `user-${teacherId.slice(0, 8)}`,
    name: 'Teacher Test',
    email: 'teacher@test.com',
    password: 'hashed',
    schoolId,
    school: null,
    role: UserRole.TEACHER,
    teacherId,
    teacher: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as unknown as UserEntity;
}

function buildAuthService(activeAssignments: AssignmentData[]): {
  authService: AuthService;
  jwtService: ReturnType<typeof buildMockJwtService>;
} {
  const jwtService = buildMockJwtService();
  const userRepository = buildMockUserRepository();
  const tsaService = buildMockTeacherSchoolAssignmentService(activeAssignments);

  const authService = new AuthService(
    userRepository as never,
    jwtService as never,
    tsaService as TeacherSchoolAssignmentService,
    null,
  );

  return { authService, jwtService };
}

// --- Property Tests ---

describe('Property 5: JWT Accessible Schools Completeness', () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * For any teacher with N active Teacher_School_Assignments,
   * generateToken SHALL produce a JWT where accessibleSchoolIds
   * contains exactly N school IDs matching those active assignments.
   */
  it('should include exactly N school IDs in JWT accessibleSchoolIds matching active assignments', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbActiveAssignments,
        async ({ teacherId, primarySchoolId, assignments }) => {
          // Arrange
          const activeAssignments = assignments.filter(
            (a) => a.status === AssignmentStatus.ACTIVE,
          );
          const expectedSchoolIds = activeAssignments.map((a) => a.schoolId);
          const { authService, jwtService } =
            buildAuthService(activeAssignments);

          const user = buildTeacherUser(teacherId, primarySchoolId);

          // Act
          await authService.generateToken(user);

          // Assert: jwtService.sign was called with the correct payload
          expect(jwtService.sign).toHaveBeenCalledTimes(1);
          const signedPayload = jwtService.sign.mock.calls[0][0] as JwtPayload;

          // accessibleSchoolIds must be present and contain exactly N school IDs
          expect(signedPayload.accessibleSchoolIds).toBeDefined();
          expect(signedPayload.accessibleSchoolIds).toHaveLength(
            expectedSchoolIds.length,
          );

          // All expected school IDs must be present
          const sortedExpected = [...expectedSchoolIds].sort();
          const sortedActual = [
            ...(signedPayload.accessibleSchoolIds ?? []),
          ].sort();
          expect(sortedActual).toEqual(sortedExpected);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * Only active assignments contribute to the JWT accessibleSchoolIds.
   * Inactive assignments SHALL NOT appear in the JWT claim.
   */
  it('should exclude inactive assignment school IDs from JWT accessibleSchoolIds', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbMixedAssignments,
        async ({
          teacherId,
          primarySchoolId,
          activeAssignments,
          expectedSchoolIds,
          assignments,
        }) => {
          // Arrange
          const { authService, jwtService } =
            buildAuthService(activeAssignments);
          const user = buildTeacherUser(teacherId, primarySchoolId);

          // Identify inactive school IDs that should NOT be in the JWT
          const inactiveSchoolIds = assignments
            .filter((a) => a.status === AssignmentStatus.INACTIVE)
            .map((a) => a.schoolId);

          // Act
          await authService.generateToken(user);

          // Assert
          expect(jwtService.sign).toHaveBeenCalledTimes(1);
          const signedPayload = jwtService.sign.mock.calls[0][0] as JwtPayload;

          // Should contain exactly the active assignment school IDs
          expect(signedPayload.accessibleSchoolIds).toBeDefined();
          expect(signedPayload.accessibleSchoolIds).toHaveLength(
            expectedSchoolIds.length,
          );

          // None of the inactive school IDs should be present
          for (const inactiveId of inactiveSchoolIds) {
            expect(signedPayload.accessibleSchoolIds).not.toContain(inactiveId);
          }

          // All active school IDs should be present
          for (const activeId of expectedSchoolIds) {
            expect(signedPayload.accessibleSchoolIds).toContain(activeId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * The count of accessibleSchoolIds in the JWT SHALL equal the count of
   * active Teacher_School_Assignments, regardless of how many total
   * assignments (active + inactive) exist.
   */
  it('should have accessibleSchoolIds count equal to active assignment count', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbMixedAssignments,
        async ({ teacherId, primarySchoolId, activeAssignments }) => {
          // Arrange
          const { authService, jwtService } =
            buildAuthService(activeAssignments);
          const user = buildTeacherUser(teacherId, primarySchoolId);

          // Act
          await authService.generateToken(user);

          // Assert
          const signedPayload = jwtService.sign.mock.calls[0][0] as JwtPayload;
          expect(signedPayload.accessibleSchoolIds).toHaveLength(
            activeAssignments.length,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
