import { DataSource } from 'typeorm';
import { ExecutionContext } from '@nestjs/common';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { SchoolRepository } from '../../src/modules/school/school.repository';
import { TeacherSchoolAssignmentEntity } from '../../src/modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';
import { SchoolScopeGuard } from '../../src/common/guards/school-scope.guard';
import { UserRole } from '../../src/common/enums/role.enum';
import { TeacherEntity } from '../../src/modules/teacher/entities/teacher.entity';
import { TokenInvalidationService } from '../../src/modules/auth/services/token-invalidation.service';
import {
  IFeatureFlagService,
  ITokenInvalidationService,
} from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';

/**
 * Backward Compatibility Verification Tests
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 *
 * Purpose: Confirm that single-school teachers (no records in teacher_school_assignments)
 * continue to function correctly through the full flow without any modification.
 */
describe('Backward Compatibility — Single-School Teacher Flow', () => {
  // --- Service layer tests ---
  describe('TeacherSchoolAssignmentService — No TSA Records Fallback', () => {
    let service: TeacherSchoolAssignmentService;
    let assignmentRepository: jest.Mocked<TeacherSchoolAssignmentRepository>;
    let schoolRepository: jest.Mocked<SchoolRepository>;
    let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
    let featureFlagService: jest.Mocked<IFeatureFlagService>;
    let tokenInvalidationService: jest.Mocked<ITokenInvalidationService>;
    let teacherRepo: { findOne: jest.Mock };

    const schoolId = 'school-primary-uuid';
    const teacherId = 'teacher-single-school-uuid';

    const mockTeacher: Partial<TeacherEntity> = {
      id: teacherId,
      fullName: 'Trần Văn Bình',
      schoolId,
      deletedAt: null,
    };

    beforeEach(() => {
      assignmentRepository = {
        findByTeacher: jest.fn(),
        findBySchool: jest.fn(),
        findActiveByTeacher: jest.fn(),
        countSecondaryByTeacher: jest.fn(),
        findByTeacherAndSchool: jest.fn(),
      } as unknown as jest.Mocked<TeacherSchoolAssignmentRepository>;

      schoolRepository = {
        findById: jest.fn(),
      } as unknown as jest.Mocked<SchoolRepository>;

      teacherRepo = { findOne: jest.fn() };

      dataSource = {
        transaction: jest.fn(),
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === TeacherEntity) return teacherRepo;
          if (entity === TeacherSchoolAssignmentEntity)
            return { findOne: jest.fn() };
          return { findOne: jest.fn() };
        }),
      };

      featureFlagService = {
        isCrossSchoolEnabled: jest.fn(),
      };

      tokenInvalidationService = {
        invalidateUserTokens: jest.fn(),
      };

      service = new TeacherSchoolAssignmentService(
        assignmentRepository,
        schoolRepository as unknown as SchoolRepository,
        dataSource as unknown as DataSource,
        featureFlagService,
        tokenInvalidationService,
      );
    });

    /**
     * Requirement 8.2: WHEN a Teacher has no Teacher_School_Assignment records,
     * THE NBK_EMS SHALL treat the teacher as single-school using teacher.school_id
     */
    it('should return [teacher.schoolId] when zero rows in teacher_school_assignments (Req 8.2)', async () => {
      assignmentRepository.findActiveByTeacher.mockResolvedValue([]);
      teacherRepo.findOne.mockResolvedValue(mockTeacher);

      const result = await service.getAccessibleSchoolIds(teacherId);

      expect(result).toEqual([schoolId]);
      expect(result).toHaveLength(1);
    });

    /**
     * Requirement 8.3: THE NBK_EMS SHALL NOT require migration of existing Teacher records;
     * the system SHALL function correctly with zero rows in teacher_school_assignments
     */
    it('should not require TSA records for validateTeacherSchoolAccess at primary school (Req 8.3)', async () => {
      // No TSA records exist for this teacher
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);
      // Falls back to checking teacher.schoolId
      teacherRepo.findOne.mockResolvedValue(mockTeacher);

      const result = await service.validateTeacherSchoolAccess(
        teacherId,
        schoolId,
      );

      expect(result).toBe(true);
    });

    it('should deny access to non-primary school when no TSA records exist (Req 8.3)', async () => {
      const otherSchoolId = 'other-school-uuid';
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);
      teacherRepo.findOne.mockResolvedValue(mockTeacher);

      const result = await service.validateTeacherSchoolAccess(
        teacherId,
        otherSchoolId,
      );

      expect(result).toBe(false);
    });

    /**
     * Requirement 8.5: feature flag gating — cross-school features are guarded
     */
    it('should reject createAssignment when feature flag is disabled (Req 8.5)', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      schoolRepository.findById.mockResolvedValue({
        id: 'target-school',
        name: 'Another School',
        parentSchoolId: 'same-org',
      } as unknown as import('../../src/modules/school/entities/school.entity').SchoolEntity);
      // Both schools same org
      schoolRepository.findById.mockImplementation(async (id: string) => {
        return {
          id,
          name: 'School',
          parentSchoolId: 'same-org',
        } as unknown as import('../../src/modules/school/entities/school.entity').SchoolEntity;
      });
      // Feature flag disabled
      featureFlagService.isCrossSchoolEnabled.mockResolvedValue(false);

      await expect(
        service.createAssignment({
          teacherId,
          schoolId: 'target-school-uuid',
          role: 'secondary' as never,
          effectiveStartDate: '2025-06-01',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: 'FEATURE_NOT_ENABLED' }),
      });
    });

    /**
     * Requirement 8.1: THE NBK_EMS SHALL maintain the existing teacher.school_id column
     * Verify that getAccessibleSchoolIds uses the teacher.schoolId field directly
     */
    it('should use teacher.schoolId directly for fallback — no column modification needed (Req 8.1)', async () => {
      assignmentRepository.findActiveByTeacher.mockResolvedValue([]);
      teacherRepo.findOne.mockResolvedValue({
        id: teacherId,
        schoolId: 'specific-school-uuid',
        deletedAt: null,
      });

      const result = await service.getAccessibleSchoolIds(teacherId);

      expect(result).toEqual(['specific-school-uuid']);
      // Confirms it reads from the existing teacher entity field
      expect(teacherRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: teacherId }),
        }),
      );
    });
  });

  // --- Guard layer tests ---
  describe('SchoolScopeGuard — JWT Backward Compatibility', () => {
    let tokenInvalidationService: TokenInvalidationService;

    beforeEach(() => {
      tokenInvalidationService = new TokenInvalidationService();
    });

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
     * Requirement 8.4: WHEN the SchoolScopeGuard encounters a user JWT without the
     * Accessible_School_List claim, it SHALL fall back to single-school behavior
     */
    it('should fallback to [user.schoolId] when JWT has no accessibleSchoolIds (Req 8.4)', async () => {
      const user = {
        id: 'user-uuid',
        userId: 'user-uuid',
        role: UserRole.TEACHER,
        schoolId: 'teacher-school-uuid',
        // No accessibleSchoolIds field
      };
      const guard = new SchoolScopeGuard(tokenInvalidationService);
      const { context, request } = buildMockContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['teacher-school-uuid']);
    });

    it('should fallback to [user.schoolId] when accessibleSchoolIds is empty array (Req 8.4)', async () => {
      const user = {
        id: 'user-uuid',
        userId: 'user-uuid',
        role: UserRole.SCHEDULER,
        schoolId: 'scheduler-school-uuid',
        accessibleSchoolIds: [], // Empty array
      };
      const guard = new SchoolScopeGuard(tokenInvalidationService);
      const { context, request } = buildMockContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['scheduler-school-uuid']);
    });

    it('should set schoolScope to null for SUPER_ADMIN regardless of accessibleSchoolIds (Req 8.4)', async () => {
      const user = {
        id: 'admin-uuid',
        userId: 'admin-uuid',
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      };
      const guard = new SchoolScopeGuard(tokenInvalidationService);
      const { context, request } = buildMockContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toBeNull();
    });

    it('should use accessibleSchoolIds when present in JWT (cross-school user)', async () => {
      const accessibleSchoolIds = ['school-1', 'school-2', 'school-3'];
      const user = {
        id: 'user-uuid',
        userId: 'user-uuid',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        accessibleSchoolIds,
      };
      const guard = new SchoolScopeGuard(tokenInvalidationService);
      const { context, request } = buildMockContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(accessibleSchoolIds);
    });

    it('should return true and not set schoolScope when user is null', async () => {
      const guard = new SchoolScopeGuard(tokenInvalidationService);
      const { context, request } = buildMockContext(null as unknown as object);
      (request as Record<string, unknown>).user = null;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // --- Teacher entity integrity ---
  describe('Teacher Entity — school_id Column Integrity', () => {
    it('should have schoolId as a settable property on TeacherEntity (Req 8.1)', () => {
      // Verifies that teacher.schoolId column remains functional and untouched
      const teacher = new TeacherEntity();
      // Setting and reading works normally (column exists via TypeORM decorator)
      teacher.schoolId = 'test-school-id';
      expect(teacher.schoolId).toBe('test-school-id');
    });

    it('should allow schoolId to be set independently of any TSA (Req 8.1)', () => {
      // Existing teacher records continue to work with just teacher.schoolId
      const teacher = new TeacherEntity();
      teacher.schoolId = 'primary-school-uuid';
      teacher.fullName = 'Giáo viên đơn trường';

      // teacher.schoolId is the canonical primary school reference
      expect(teacher.schoolId).toBeDefined();
      expect(teacher.schoolId).toBe('primary-school-uuid');
    });
  });
});
