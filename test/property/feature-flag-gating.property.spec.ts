import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { SchoolRepository } from '../../src/modules/school/school.repository';
import { SchoolEntity } from '../../src/modules/school/entities/school.entity';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';

/**
 * Property 23: Feature Flag Gating
 *
 * When the CROSS_SCHOOL_ENABLED feature flag is false for an organization,
 * ALL cross-school assignment creation attempts SHALL be rejected with
 * FEATURE_NOT_ENABLED error, regardless of valid teacher, school, role, or dates.
 *
 * When the CROSS_SCHOOL_ENABLED feature flag is true for an organization,
 * assignment creation SHALL NOT be rejected due to the feature flag
 * (may still fail for other reasons).
 *
 * **Validates: Requirements 8.5**
 */

// --- Types ---

interface SchoolData {
  id: string;
  parentSchoolId: string | null;
  code: string;
  name: string;
}

// --- Generators ---

/**
 * Generate a valid assignment creation input.
 * Produces a teacher, two schools (same org), role, and a date.
 */
/**
 * Generate a date string in YYYY-MM-DD format.
 */
const arbDateString = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(
    ([year, month, day]) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

const arbValidAssignmentInput = fc
  .tuple(
    fc.uuid(), // orgId
    fc.uuid(), // schoolAId (teacher's primary school)
    fc.uuid(), // schoolBId (target secondary school)
    fc.uuid(), // teacherId
    fc.constantFrom(AssignmentRole.SECONDARY, AssignmentRole.PRIMARY), // role
    arbDateString,
  )
  .filter(
    ([orgId, schoolAId, schoolBId, teacherId]) =>
      orgId !== schoolAId &&
      orgId !== schoolBId &&
      schoolAId !== schoolBId &&
      teacherId !== orgId &&
      teacherId !== schoolAId &&
      teacherId !== schoolBId,
  )
  .map(([orgId, schoolAId, schoolBId, teacherId, role, dateStr]) => ({
    orgId,
    schoolA: {
      id: schoolAId,
      parentSchoolId: orgId,
      code: `SCH-${schoolAId.slice(0, 8)}`,
      name: `School ${schoolAId.slice(0, 8)}`,
    } as SchoolData,
    schoolB: {
      id: schoolBId,
      parentSchoolId: orgId,
      code: `SCH-${schoolBId.slice(0, 8)}`,
      name: `School ${schoolBId.slice(0, 8)}`,
    } as SchoolData,
    teacherId,
    role,
    effectiveStartDate: dateStr,
  }));

// --- Mock Builders ---

function buildSchoolRepository(
  schools: Map<string, SchoolData>,
): SchoolRepository {
  return {
    findById: jest.fn(async (id: string): Promise<SchoolEntity | null> => {
      const data = schools.get(id);
      if (!data) return null;
      return {
        id: data.id,
        parentSchoolId: data.parentSchoolId,
        code: data.code,
        name: data.name,
        address: null,
        phone: null,
        email: null,
        principalName: null,
        parentSchool: null,
        childSchools: [],
        status: 'active' as never,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as unknown as SchoolEntity;
    }),
  } as unknown as SchoolRepository;
}

function buildAssignmentRepository(): TeacherSchoolAssignmentRepository {
  return {
    findByTeacherAndSchool: jest.fn(async () => null),
    countSecondaryByTeacher: jest.fn(async () => 0),
    findActiveByTeacher: jest.fn(async () => []),
    findByTeacher: jest.fn(async () => []),
  } as unknown as TeacherSchoolAssignmentRepository;
}

function buildDataSource(teacherSchoolId: string, teacherId: string) {
  return {
    getRepository: jest.fn(() => ({
      findOne: jest.fn(async () => ({
        id: teacherId,
        schoolId: teacherSchoolId,
        deletedAt: null,
      })),
    })),
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        create: jest.fn((_entity: unknown, data: unknown) => ({
          id: 'new-assignment-id',
          ...(data as Record<string, unknown>),
        })),
        save: jest.fn(async (_entity: unknown, data: unknown) => data),
      };
      return cb(manager);
    }),
  } as unknown;
}

function buildService(
  schools: Map<string, SchoolData>,
  teacherSchoolId: string,
  teacherId: string,
  featureFlagEnabled: boolean,
): TeacherSchoolAssignmentService {
  const schoolRepo = buildSchoolRepository(schools);
  const assignmentRepo = buildAssignmentRepository();
  const dataSource = buildDataSource(teacherSchoolId, teacherId);
  const featureFlagService = {
    isCrossSchoolEnabled: jest.fn(async () => featureFlagEnabled),
  };

  return new TeacherSchoolAssignmentService(
    assignmentRepo,
    schoolRepo,
    dataSource as never,
    featureFlagService,
    null, // tokenInvalidationService
  );
}

// --- Property Tests ---

describe('Property 23: Feature Flag Gating', () => {
  /**
   * **Validates: Requirements 8.5**
   *
   * When the CROSS_SCHOOL_ENABLED feature flag is false for an organization,
   * ALL cross-school assignment creation attempts SHALL be rejected with
   * FEATURE_NOT_ENABLED error, regardless of valid teacher, school, role, or dates.
   */
  it('should REJECT all assignment creation when feature flag is FALSE', async () => {
    await fc.assert(
      fc.asyncProperty(arbValidAssignmentInput, async (input) => {
        const { schoolA, schoolB, teacherId, role, effectiveStartDate } = input;

        // Setup schools
        const schools = new Map<string, SchoolData>();
        schools.set(schoolA.id, schoolA);
        schools.set(schoolB.id, schoolB);

        // Feature flag is FALSE
        const service = buildService(schools, schoolA.id, teacherId, false);

        // Act & Assert: creation should be rejected with FEATURE_NOT_ENABLED
        try {
          await service.createAssignment({
            teacherId,
            schoolId: schoolB.id,
            role,
            effectiveStartDate,
          });
          // If we reach here, no error was thrown — that's a failure
          fail('Expected FEATURE_NOT_ENABLED error but assignment succeeded');
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          const response = (
            error as ForbiddenException
          ).getResponse() as Record<string, unknown>;
          expect(response.errorCode).toBe('FEATURE_NOT_ENABLED');
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.5**
   *
   * When the CROSS_SCHOOL_ENABLED feature flag is true for an organization,
   * assignment creation SHALL NOT be rejected due to the feature flag
   * (may still fail for other validation reasons, but NOT with FEATURE_NOT_ENABLED).
   */
  it('should NOT reject with FEATURE_NOT_ENABLED when feature flag is TRUE', async () => {
    await fc.assert(
      fc.asyncProperty(arbValidAssignmentInput, async (input) => {
        const { schoolA, schoolB, teacherId, role, effectiveStartDate } = input;

        // Setup schools
        const schools = new Map<string, SchoolData>();
        schools.set(schoolA.id, schoolA);
        schools.set(schoolB.id, schoolB);

        // Feature flag is TRUE
        const service = buildService(schools, schoolA.id, teacherId, true);

        // Act: create assignment — may succeed or fail for other reasons
        try {
          await service.createAssignment({
            teacherId,
            schoolId: schoolB.id,
            role,
            effectiveStartDate,
          });
          // Success is acceptable — feature flag didn't block it
        } catch (error) {
          // If an error is thrown, it SHALL NOT be FEATURE_NOT_ENABLED
          if (error instanceof ForbiddenException) {
            const response = (
              error as ForbiddenException
            ).getResponse() as Record<string, unknown>;
            expect(response.errorCode).not.toBe('FEATURE_NOT_ENABLED');
          }
          // Other errors (e.g., duplicate, max exceeded) are acceptable
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.5**
   *
   * Feature flag gating applies regardless of the assignment role
   * (primary or secondary) — when flag is off, all roles are blocked.
   */
  it('should REJECT both PRIMARY and SECONDARY roles when feature flag is FALSE', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(
            fc.uuid(), // orgId
            fc.uuid(), // schoolAId
            fc.uuid(), // schoolBId
            fc.uuid(), // teacherId
            arbDateString,
          )
          .filter(
            ([orgId, schoolAId, schoolBId, teacherId]) =>
              orgId !== schoolAId &&
              orgId !== schoolBId &&
              schoolAId !== schoolBId &&
              teacherId !== orgId,
          ),
        async ([
          orgId,
          schoolAId,
          schoolBId,
          teacherId,
          effectiveStartDate,
        ]) => {
          const schoolA: SchoolData = {
            id: schoolAId,
            parentSchoolId: orgId,
            code: `SCH-${schoolAId.slice(0, 8)}`,
            name: `School A`,
          };
          const schoolB: SchoolData = {
            id: schoolBId,
            parentSchoolId: orgId,
            code: `SCH-${schoolBId.slice(0, 8)}`,
            name: `School B`,
          };

          const schools = new Map<string, SchoolData>();
          schools.set(schoolA.id, schoolA);
          schools.set(schoolB.id, schoolB);

          // Test with both roles
          for (const role of [
            AssignmentRole.PRIMARY,
            AssignmentRole.SECONDARY,
          ]) {
            const service = buildService(schools, schoolA.id, teacherId, false);

            try {
              await service.createAssignment({
                teacherId,
                schoolId: schoolB.id,
                role,
                effectiveStartDate,
              });
              fail(
                `Expected FEATURE_NOT_ENABLED error for role ${role} but assignment succeeded`,
              );
            } catch (error) {
              expect(error).toBeInstanceOf(ForbiddenException);
              const response = (
                error as ForbiddenException
              ).getResponse() as Record<string, unknown>;
              expect(response.errorCode).toBe('FEATURE_NOT_ENABLED');
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
