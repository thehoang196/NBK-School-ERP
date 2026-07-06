import * as fc from 'fast-check';
import { DataSource, IsNull } from 'typeorm';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { TeacherEntity } from '../../src/modules/teacher/entities/teacher.entity';
import { SchoolScopeGuard } from '../../src/common/guards/school-scope.guard';
import { UserRole } from '../../src/common/enums/role.enum';
import { ExecutionContext } from '@nestjs/common';
import { TokenInvalidationService } from '../../src/modules/auth/services/token-invalidation.service';

/**
 * Property-Based Tests for Backward Compatibility
 *
 * Properties tested:
 * - Property 21: Backward Compatibility — No Assignment Fallback
 * - Property 22: Backward Compatibility — JWT Fallback
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 8.2, 8.4**
 */

// --- Custom Arbitraries ---

/** Generate a teacher with a valid schoolId (simulating single-school teacher) */
const arbTeacherWithSchool = fc
  .tuple(fc.uuid(), fc.uuid())
  .map(([teacherId, schoolId]) => ({
    id: teacherId,
    schoolId,
    deletedAt: null as Date | null,
  }));

/** Generate a teacher with no assignment records in teacher_school_assignments */
const arbTeacherNoAssignments = fc
  .tuple(fc.uuid(), fc.uuid(), fc.string({ minLength: 3, maxLength: 10 }))
  .map(([teacherId, schoolId, fullName]) => ({
    id: teacherId,
    schoolId,
    fullName,
    deletedAt: null as Date | null,
  }));

/** Non-SUPER_ADMIN roles that are subject to schoolScope filtering */
const nonSuperAdminRoles = [
  UserRole.SCHOOL_ADMIN,
  UserRole.SCHEDULER,
  UserRole.TEACHER,
  UserRole.VIEWER,
  UserRole.HR,
];

const arbNonSuperAdminRole = fc.constantFrom(...nonSuperAdminRoles);

/**
 * Generator: arbLegacyJwtUser
 * Generates a JWT user payload WITHOUT accessibleSchoolIds (old-style JWT).
 * This simulates a teacher who was authenticated before cross-campus feature existed.
 */
const arbLegacyJwtUser = fc
  .tuple(fc.uuid(), arbNonSuperAdminRole, fc.uuid())
  .map(([userId, role, schoolId]) => ({
    id: userId,
    userId,
    role,
    schoolId,
  }));

/**
 * Generator: arbLegacyJwtUserWithEmptyArray
 * Generates a JWT user payload with accessibleSchoolIds = [] (empty array case).
 */
const arbLegacyJwtUserWithEmptyArray = fc
  .tuple(fc.uuid(), arbNonSuperAdminRole, fc.uuid())
  .map(([userId, role, schoolId]) => ({
    id: userId,
    userId,
    role,
    schoolId,
    accessibleSchoolIds: [] as string[],
  }));

// --- Mock Helpers ---

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

/**
 * Creates a mock TeacherSchoolAssignmentService for Property 21 tests.
 * The repository mock returns empty array (zero active assignments).
 * The DataSource mock returns the teacher entity with the given schoolId.
 */
function buildServiceWithNoAssignments(teacher: {
  id: string;
  schoolId: string;
  deletedAt: Date | null;
}): TeacherSchoolAssignmentService {
  // Mock repository that returns zero active assignments
  const mockRepository = {
    findActiveByTeacher: jest.fn().mockResolvedValue([]),
    findByTeacher: jest.fn().mockResolvedValue([]),
    findBySchool: jest.fn().mockResolvedValue([]),
    findByTeacherAndSchool: jest.fn().mockResolvedValue(null),
    countSecondaryByTeacher: jest.fn().mockResolvedValue(0),
  } as unknown as TeacherSchoolAssignmentRepository;

  // Mock DataSource that returns the teacher entity
  const mockTeacherRepo = {
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === teacher.id) {
          return Promise.resolve(teacher);
        }
        return Promise.resolve(null);
      }),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockTeacherRepo),
    transaction: jest.fn(),
  } as unknown as DataSource;

  const mockSchoolRepository = {} as any;

  return new TeacherSchoolAssignmentService(
    mockRepository,
    mockSchoolRepository,
    mockDataSource,
    null, // featureFlagService
    null, // tokenInvalidationService
  );
}

/**
 * Creates a mock service where teacher does NOT exist (deleted or non-existent).
 */
function buildServiceWithNonExistentTeacher(): TeacherSchoolAssignmentService {
  const mockRepository = {
    findActiveByTeacher: jest.fn().mockResolvedValue([]),
    findByTeacher: jest.fn().mockResolvedValue([]),
    findBySchool: jest.fn().mockResolvedValue([]),
    findByTeacherAndSchool: jest.fn().mockResolvedValue(null),
    countSecondaryByTeacher: jest.fn().mockResolvedValue(0),
  } as unknown as TeacherSchoolAssignmentRepository;

  const mockTeacherRepo = {
    findOne: jest.fn().mockResolvedValue(null),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockTeacherRepo),
    transaction: jest.fn(),
  } as unknown as DataSource;

  const mockSchoolRepository = {} as any;

  return new TeacherSchoolAssignmentService(
    mockRepository,
    mockSchoolRepository,
    mockDataSource,
    null,
    null,
  );
}

// --- Property Tests ---

describe('Feature: cross-campus-teaching | Backward Compatibility Property Tests', () => {
  /**
   * Property 21: Backward Compatibility — No Assignment Fallback
   *
   * For any teacher with zero TSA (Teacher_School_Assignment) records,
   * getAccessibleSchoolIds() SHALL return [teacher.schoolId].
   * This ensures single-school teachers continue to function without
   * any cross-campus records being created.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 21: Backward Compatibility — No Assignment Fallback', () => {
    it('should return [teacher.schoolId] when zero TSA records exist for any teacher', async () => {
      await fc.assert(
        fc.asyncProperty(arbTeacherWithSchool, async (teacher) => {
          // Arrange: service with no active assignments
          const service = buildServiceWithNoAssignments(teacher);

          // Act
          const result = await service.getAccessibleSchoolIds(teacher.id);

          // Assert: fallback returns exactly [teacher.schoolId]
          expect(result).toEqual([teacher.schoolId]);
        }),
        { numRuns: 100 },
      );
    });

    it('should return exactly one element (the primary school) for any teacher without assignments', async () => {
      await fc.assert(
        fc.asyncProperty(arbTeacherWithSchool, async (teacher) => {
          // Arrange
          const service = buildServiceWithNoAssignments(teacher);

          // Act
          const result = await service.getAccessibleSchoolIds(teacher.id);

          // Assert: array with exactly one element
          expect(result).toHaveLength(1);
          expect(result[0]).toBe(teacher.schoolId);
        }),
        { numRuns: 100 },
      );
    });

    it('should return empty array when teacher does not exist and has no TSA records', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // random teacherId that doesn't exist
          async (teacherId) => {
            // Arrange: service where teacher is not found
            const service = buildServiceWithNonExistentTeacher();

            // Act
            const result = await service.getAccessibleSchoolIds(teacherId);

            // Assert: returns empty array when teacher doesn't exist
            expect(result).toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return undefined or null for any valid teacher with zero assignments', async () => {
      await fc.assert(
        fc.asyncProperty(arbTeacherNoAssignments, async (teacher) => {
          // Arrange
          const service = buildServiceWithNoAssignments(teacher);

          // Act
          const result = await service.getAccessibleSchoolIds(teacher.id);

          // Assert: result is always a defined array
          expect(result).toBeDefined();
          expect(result).not.toBeNull();
          expect(Array.isArray(result)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('the fallback schoolId should always be a valid UUID string', async () => {
      await fc.assert(
        fc.asyncProperty(arbTeacherWithSchool, async (teacher) => {
          // Arrange
          const service = buildServiceWithNoAssignments(teacher);

          // Act
          const result = await service.getAccessibleSchoolIds(teacher.id);

          // Assert: the returned school ID is a valid UUID
          expect(result).toHaveLength(1);
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(result[0]).toMatch(uuidRegex);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 22: Backward Compatibility — JWT Fallback
   *
   * For any JWT without accessibleSchoolIds claim (or with empty array),
   * SchoolScopeGuard SHALL set schoolScope = [user.schoolId].
   * This complements the guard-level tests in school-scope-guard.property.spec.ts
   * by focusing on the backward compatibility contract.
   *
   * **Validates: Requirements 8.4**
   */
  describe('Property 22: Backward Compatibility — JWT Fallback', () => {
    let tokenInvalidationService: TokenInvalidationService;

    beforeEach(() => {
      tokenInvalidationService = new TokenInvalidationService();
    });

    it('should fallback to [user.schoolId] for any non-SUPER_ADMIN user without accessibleSchoolIds', async () => {
      await fc.assert(
        fc.asyncProperty(arbLegacyJwtUser, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          const result = await guard.canActivate(context);

          // Assert: backward compat — schoolScope = [user.schoolId]
          expect(result).toBe(true);
          expect(request.schoolScope).toEqual([user.schoolId]);
        }),
        { numRuns: 100 },
      );
    });

    it('should fallback to [user.schoolId] for any user with empty accessibleSchoolIds array', async () => {
      await fc.assert(
        fc.asyncProperty(arbLegacyJwtUserWithEmptyArray, async (user) => {
          // Arrange: user has accessibleSchoolIds = [] (empty)
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          const result = await guard.canActivate(context);

          // Assert: empty accessibleSchoolIds triggers fallback
          expect(result).toBe(true);
          expect(request.schoolScope).toEqual([user.schoolId]);
        }),
        { numRuns: 100 },
      );
    });

    it('schoolScope should always contain exactly one element in fallback mode', async () => {
      await fc.assert(
        fc.asyncProperty(arbLegacyJwtUser, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          await guard.canActivate(context);

          // Assert: single-school behavior = exactly 1 element
          const scope = request.schoolScope as string[];
          expect(scope).toHaveLength(1);
          expect(scope[0]).toBe(user.schoolId);
        }),
        { numRuns: 100 },
      );
    });

    it('fallback schoolScope should match the schoolId from JWT exactly', async () => {
      await fc.assert(
        fc.asyncProperty(arbLegacyJwtUser, async (user) => {
          // Arrange
          const guard = new SchoolScopeGuard(tokenInvalidationService);
          const { context, request } = buildMockContext(user);

          // Act
          await guard.canActivate(context);

          // Assert: the fallback scope is identical to user.schoolId
          const scope = request.schoolScope as string[];
          expect(scope[0]).toStrictEqual(user.schoolId);
        }),
        { numRuns: 100 },
      );
    });
  });
});
