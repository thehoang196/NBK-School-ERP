import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { SchoolRepository } from '../../src/modules/school/school.repository';
import { SchoolEntity } from '../../src/modules/school/entities/school.entity';
import { TeacherEntity } from '../../src/modules/teacher/entities/teacher.entity';
import { TeacherSchoolAssignmentEntity } from '../../src/modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';

/**
 * Property 2: Organization Boundary Validation
 *
 * For any pair of schools (schoolA, schoolB), creating a Teacher_School_Assignment
 * linking a teacher from schoolA to schoolB SHALL succeed if and only if both schools
 * share the same parentSchoolId (belong to the same Organization).
 * If they do not, the system SHALL reject with CROSS_ORG_NOT_ALLOWED.
 *
 * **Validates: Requirements 1.3, 1.4**
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
 * Generate a school belonging to a specific organization.
 * If orgId is null, the school IS the org root.
 */
function arbSchool(
  orgId: string | null,
  schoolId: string,
): fc.Arbitrary<SchoolData> {
  return fc.record({
    id: fc.constant(schoolId),
    parentSchoolId: fc.constant(orgId),
    code: fc.constant(`SCH-${schoolId.slice(0, 8)}`),
    name: fc.constant(`School ${schoolId.slice(0, 8)}`),
  });
}

/**
 * Generate a pair of schools that belong to the SAME organization.
 */
const arbSameOrgSchoolPair = fc
  .tuple(fc.uuid(), fc.uuid(), fc.uuid())
  .filter(
    ([orgId, schoolAId, schoolBId]) =>
      schoolAId !== schoolBId && orgId !== schoolAId && orgId !== schoolBId,
  )
  .chain(([orgId, schoolAId, schoolBId]) =>
    fc.tuple(
      arbSchool(orgId, schoolAId),
      arbSchool(orgId, schoolBId),
      fc.constant(orgId),
    ),
  );

/**
 * Generate a pair of schools that belong to DIFFERENT organizations.
 */
const arbDiffOrgSchoolPair = fc
  .tuple(fc.uuid(), fc.uuid(), fc.uuid(), fc.uuid())
  .filter(
    ([orgAId, orgBId, schoolAId, schoolBId]) =>
      orgAId !== orgBId &&
      schoolAId !== schoolBId &&
      orgAId !== schoolAId &&
      orgBId !== schoolBId,
  )
  .chain(([orgAId, orgBId, schoolAId, schoolBId]) =>
    fc.tuple(
      arbSchool(orgAId, schoolAId),
      arbSchool(orgBId, schoolBId),
      fc.constant(orgAId),
      fc.constant(orgBId),
    ),
  );

/**
 * Generate a case where one school IS the org root (parentSchoolId=null)
 * and the other school belongs to that org.
 */
const arbOrgRootAndChildPair = fc
  .tuple(fc.uuid(), fc.uuid())
  .filter(([orgRootId, childId]) => orgRootId !== childId)
  .chain(([orgRootId, childId]) =>
    fc.tuple(
      arbSchool(null, orgRootId), // org root: parentSchoolId = null, id = orgRootId
      arbSchool(orgRootId, childId), // child: parentSchoolId = orgRootId
      fc.constant(orgRootId),
    ),
  );

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

function buildDataSource(teacherSchoolId: string) {
  return {
    getRepository: jest.fn(() => ({
      findOne: jest.fn(async () => ({
        id: 'teacher-1',
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
  featureFlagEnabled = true,
): TeacherSchoolAssignmentService {
  const schoolRepo = buildSchoolRepository(schools);
  const assignmentRepo = buildAssignmentRepository();
  const dataSource = buildDataSource(teacherSchoolId);
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

describe('Property 2: Organization Boundary Validation', () => {
  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * For any pair of schools that share the same parentSchoolId (same org),
   * createAssignment SHALL succeed.
   */
  it('should ALLOW assignment when both schools belong to the SAME organization', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSameOrgSchoolPair,
        async ([schoolA, schoolB, _orgId]) => {
          // Setup school data
          const schools = new Map<string, SchoolData>();
          schools.set(schoolA.id, schoolA);
          schools.set(schoolB.id, schoolB);

          const service = buildService(schools, schoolA.id);

          // Act: create assignment from schoolA teacher to schoolB
          const result = await service.createAssignment({
            teacherId: 'teacher-1',
            schoolId: schoolB.id,
            role: AssignmentRole.SECONDARY,
            effectiveStartDate: '2025-01-15',
          });

          // Assert: assignment should succeed
          expect(result).toBeDefined();
          expect(result.schoolId).toBe(schoolB.id);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * For any pair of schools belonging to DIFFERENT organizations,
   * createAssignment SHALL be rejected with CROSS_ORG_NOT_ALLOWED.
   */
  it('should REJECT assignment when schools belong to DIFFERENT organizations', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDiffOrgSchoolPair,
        async ([schoolA, schoolB, _orgAId, _orgBId]) => {
          // Setup school data
          const schools = new Map<string, SchoolData>();
          schools.set(schoolA.id, schoolA);
          schools.set(schoolB.id, schoolB);

          const service = buildService(schools, schoolA.id);

          // Act & Assert: createAssignment should throw CROSS_ORG_NOT_ALLOWED
          try {
            await service.createAssignment({
              teacherId: 'teacher-1',
              schoolId: schoolB.id,
              role: AssignmentRole.SECONDARY,
              effectiveStartDate: '2025-01-15',
            });
            // If we reach here, it means no error was thrown — that's a failure
            fail(
              'Expected CROSS_ORG_NOT_ALLOWED error but assignment succeeded',
            );
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            const response = (
              error as BadRequestException
            ).getResponse() as Record<string, unknown>;
            expect(response.errorCode).toBe('CROSS_ORG_NOT_ALLOWED');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * When one school IS the org root (parentSchoolId = null) and the other
   * is a child of that org, they belong to the same organization and assignment
   * SHALL succeed.
   */
  it('should ALLOW assignment when one school is the org root and the other is its child', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbOrgRootAndChildPair,
        async ([orgRootSchool, childSchool, _orgRootId]) => {
          // Setup school data
          const schools = new Map<string, SchoolData>();
          schools.set(orgRootSchool.id, orgRootSchool);
          schools.set(childSchool.id, childSchool);

          // Teacher belongs to the org root
          const service = buildService(schools, orgRootSchool.id);

          // Act: create assignment from org root teacher to child school
          const result = await service.createAssignment({
            teacherId: 'teacher-1',
            schoolId: childSchool.id,
            role: AssignmentRole.SECONDARY,
            effectiveStartDate: '2025-01-15',
          });

          // Assert: should succeed
          expect(result).toBeDefined();
          expect(result.schoolId).toBe(childSchool.id);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * When one school IS the org root (parentSchoolId = null) and the other
   * belongs to a DIFFERENT org, assignment SHALL be rejected.
   */
  it('should REJECT assignment when org root and school belong to different orgs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(fc.uuid(), fc.uuid(), fc.uuid())
          .filter(
            ([orgAId, orgBId, childId]) =>
              orgAId !== orgBId && orgAId !== childId && orgBId !== childId,
          ),
        async ([orgAId, orgBId, childId]) => {
          // orgA is an org root (parentSchoolId = null)
          const orgRootSchool: SchoolData = {
            id: orgAId,
            parentSchoolId: null,
            code: `ORG-${orgAId.slice(0, 8)}`,
            name: `Org ${orgAId.slice(0, 8)}`,
          };

          // childSchool belongs to a different org (orgB)
          const childSchool: SchoolData = {
            id: childId,
            parentSchoolId: orgBId,
            code: `SCH-${childId.slice(0, 8)}`,
            name: `School ${childId.slice(0, 8)}`,
          };

          const schools = new Map<string, SchoolData>();
          schools.set(orgRootSchool.id, orgRootSchool);
          schools.set(childSchool.id, childSchool);

          const service = buildService(schools, orgRootSchool.id);

          // Act & Assert: should reject
          try {
            await service.createAssignment({
              teacherId: 'teacher-1',
              schoolId: childSchool.id,
              role: AssignmentRole.SECONDARY,
              effectiveStartDate: '2025-01-15',
            });
            fail(
              'Expected CROSS_ORG_NOT_ALLOWED error but assignment succeeded',
            );
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            const response = (
              error as BadRequestException
            ).getResponse() as Record<string, unknown>;
            expect(response.errorCode).toBe('CROSS_ORG_NOT_ALLOWED');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * The validateSameOrganization method is the core logic:
   * - same school => true
   * - same parentSchoolId => true
   * - one is org root and other is child of that org => true
   * - different orgs => false
   */
  it('should correctly validate organization boundary for any school pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Same org: both have same parentSchoolId
          arbSameOrgSchoolPair.map(([a, b, orgId]) => ({
            schoolA: a,
            schoolB: b,
            expectedSameOrg: true,
            label: `same-org(${orgId.slice(0, 8)})`,
          })),
          // Different org
          arbDiffOrgSchoolPair.map(([a, b]) => ({
            schoolA: a,
            schoolB: b,
            expectedSameOrg: false,
            label: 'diff-org',
          })),
          // Org root + child
          arbOrgRootAndChildPair.map(([root, child]) => ({
            schoolA: root,
            schoolB: child,
            expectedSameOrg: true,
            label: 'org-root-child',
          })),
        ),
        async ({ schoolA, schoolB, expectedSameOrg }) => {
          const schools = new Map<string, SchoolData>();
          schools.set(schoolA.id, schoolA);
          schools.set(schoolB.id, schoolB);

          const service = buildService(schools, schoolA.id);

          const result = await service.validateSameOrganization(
            schoolA.id,
            schoolB.id,
          );

          expect(result).toBe(expectedSameOrg);
        },
      ),
      { numRuns: 150 },
    );
  });
});
