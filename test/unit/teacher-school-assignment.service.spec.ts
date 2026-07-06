import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { SchoolRepository } from '../../src/modules/school/school.repository';
import { TeacherSchoolAssignmentEntity } from '../../src/modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';
import { SchoolEntity } from '../../src/modules/school/entities/school.entity';
import { TeacherEntity } from '../../src/modules/teacher/entities/teacher.entity';
import {
  IFeatureFlagService,
  ITokenInvalidationService,
} from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';

type TransactionCallback = (entityManager: EntityManager) => Promise<unknown>;

describe('TeacherSchoolAssignmentService', () => {
  let service: TeacherSchoolAssignmentService;
  let assignmentRepository: jest.Mocked<TeacherSchoolAssignmentRepository>;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let featureFlagService: jest.Mocked<IFeatureFlagService>;
  let tokenInvalidationService: jest.Mocked<ITokenInvalidationService>;
  let teacherRepo: { findOne: jest.Mock };
  let assignmentEntityRepo: { findOne: jest.Mock };

  // Test data
  const orgId = 'org-uuid-1';
  const schoolAId = 'school-a-uuid';
  const schoolBId = 'school-b-uuid';
  const schoolOtherOrgId = 'school-other-org-uuid';
  const teacherId = 'teacher-uuid-1';
  const assignmentId = 'assignment-uuid-1';

  const mockOrgSchool: Partial<SchoolEntity> = {
    id: orgId,
    name: 'NBK Organization',
    parentSchoolId: null,
  };

  const mockSchoolA: Partial<SchoolEntity> = {
    id: schoolAId,
    name: 'Tiểu học NBK',
    parentSchoolId: orgId,
  };

  const mockSchoolB: Partial<SchoolEntity> = {
    id: schoolBId,
    name: 'THCS NBK',
    parentSchoolId: orgId,
  };

  const mockSchoolOtherOrg: Partial<SchoolEntity> = {
    id: schoolOtherOrgId,
    name: 'Trường khác tổ chức',
    parentSchoolId: 'other-org-uuid',
  };

  const mockTeacher: Partial<TeacherEntity> = {
    id: teacherId,
    fullName: 'Nguyễn Thị Mai',
    schoolId: schoolAId,
    deletedAt: null,
  };

  const mockAssignment: Partial<TeacherSchoolAssignmentEntity> = {
    id: assignmentId,
    teacherId,
    schoolId: schoolBId,
    role: AssignmentRole.SECONDARY,
    status: AssignmentStatus.ACTIVE,
    effectiveStartDate: '2025-01-15',
    effectiveEndDate: null,
    note: null,
  };

  beforeEach(() => {
    assignmentRepository = {
      findByTeacher: jest.fn(),
      findBySchool: jest.fn(),
      findActiveByTeacher: jest.fn(),
      countSecondaryByTeacher: jest.fn(),
      findByTeacherAndSchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<TeacherSchoolAssignmentRepository>;

    schoolRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<SchoolRepository>;

    teacherRepo = { findOne: jest.fn() };
    assignmentEntityRepo = { findOne: jest.fn() };

    dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === TeacherEntity) return teacherRepo;
        if (entity === TeacherSchoolAssignmentEntity)
          return assignmentEntityRepo;
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

  describe('createAssignment()', () => {
    const createDto = {
      teacherId,
      schoolId: schoolBId,
      role: AssignmentRole.SECONDARY,
      effectiveStartDate: '2025-01-15',
      effectiveEndDate: undefined,
      note: undefined,
    };

    it('should create a secondary assignment successfully (happy path)', async () => {
      // Teacher exists with primary school A
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      // All school lookups resolved by ID
      schoolRepository.findById.mockImplementation(async (id: string) => {
        if (id === schoolBId) return mockSchoolB as SchoolEntity;
        if (id === schoolAId) return mockSchoolA as SchoolEntity;
        return null;
      });
      // Feature flag enabled
      featureFlagService.isCrossSchoolEnabled.mockResolvedValue(true);
      // No duplicate
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);
      // Under limit
      assignmentRepository.countSecondaryByTeacher.mockResolvedValue(2);
      // Transaction returns the created entity
      const createdEntity = {
        ...mockAssignment,
      } as TeacherSchoolAssignmentEntity;
      dataSource.transaction.mockImplementation(
        async (cb: TransactionCallback) => {
          const mockManager = {
            create: jest.fn().mockReturnValue(createdEntity),
            save: jest.fn().mockResolvedValue(createdEntity),
          };
          return cb(mockManager as unknown as EntityManager);
        },
      );

      const result = await service.createAssignment(createDto);

      expect(result).toEqual(createdEntity);
      expect(teacherRepo.findOne).toHaveBeenCalled();
      expect(featureFlagService.isCrossSchoolEnabled).toHaveBeenCalled();
      expect(assignmentRepository.findByTeacherAndSchool).toHaveBeenCalledWith(
        teacherId,
        schoolBId,
      );
      expect(assignmentRepository.countSecondaryByTeacher).toHaveBeenCalledWith(
        teacherId,
      );
    });

    it('should reject when teacher and target school belong to different organizations', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      // Target school is from another org
      schoolRepository.findById.mockImplementation(async (id: string) => {
        if (id === schoolOtherOrgId) return mockSchoolOtherOrg as SchoolEntity;
        if (id === schoolAId) return mockSchoolA as SchoolEntity;
        return null;
      });

      const dto = { ...createDto, schoolId: schoolOtherOrgId };

      await expect(service.createAssignment(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createAssignment(dto)).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'CROSS_ORG_NOT_ALLOWED',
        }),
      });
    });

    it('should reject when maximum secondary assignments (5) exceeded', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      schoolRepository.findById.mockImplementation(async (id: string) => {
        if (id === schoolBId) return mockSchoolB as SchoolEntity;
        if (id === schoolAId) return mockSchoolA as SchoolEntity;
        return null;
      });
      featureFlagService.isCrossSchoolEnabled.mockResolvedValue(true);
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);
      // Already at max
      assignmentRepository.countSecondaryByTeacher.mockResolvedValue(5);

      await expect(service.createAssignment(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createAssignment(createDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'MAX_SECONDARY_EXCEEDED',
        }),
      });
    });

    it('should reject when duplicate assignment already exists', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      schoolRepository.findById.mockImplementation(async (id: string) => {
        if (id === schoolBId) return mockSchoolB as SchoolEntity;
        if (id === schoolAId) return mockSchoolA as SchoolEntity;
        return null;
      });
      featureFlagService.isCrossSchoolEnabled.mockResolvedValue(true);
      // Duplicate found
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue(
        mockAssignment as TeacherSchoolAssignmentEntity,
      );

      await expect(service.createAssignment(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createAssignment(createDto)).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'DUPLICATE_SCHOOL_ASSIGNMENT',
        }),
      });
    });

    it('should reject when feature flag is disabled', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher);
      schoolRepository.findById.mockImplementation(async (id: string) => {
        if (id === schoolBId) return mockSchoolB as SchoolEntity;
        if (id === schoolAId) return mockSchoolA as SchoolEntity;
        return null;
      });
      featureFlagService.isCrossSchoolEnabled.mockResolvedValue(false);

      await expect(service.createAssignment(createDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.createAssignment(createDto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: 'FEATURE_NOT_ENABLED' }),
      });
    });

    it('should reject when teacher does not exist', async () => {
      teacherRepo.findOne.mockResolvedValue(null);

      await expect(service.createAssignment(createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deactivateAssignment()', () => {
    const mockSecondaryAssignment: Partial<TeacherSchoolAssignmentEntity> = {
      id: assignmentId,
      teacherId,
      schoolId: schoolBId,
      role: AssignmentRole.SECONDARY,
      status: AssignmentStatus.ACTIVE,
      teacher: mockTeacher as TeacherEntity,
    };

    const mockPrimaryAssignment: Partial<TeacherSchoolAssignmentEntity> = {
      id: 'primary-assignment-uuid',
      teacherId,
      schoolId: schoolAId,
      role: AssignmentRole.PRIMARY,
      status: AssignmentStatus.ACTIVE,
      teacher: mockTeacher as TeacherEntity,
    };

    it('should deactivate a secondary assignment and cascade to teaching assignments', async () => {
      assignmentEntityRepo.findOne.mockResolvedValue(mockSecondaryAssignment);
      const mockManager = {
        softDelete: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue(undefined),
      };
      dataSource.transaction.mockImplementation(
        async (cb: TransactionCallback) => {
          return cb(mockManager as unknown as EntityManager);
        },
      );
      tokenInvalidationService.invalidateUserTokens.mockResolvedValue(
        undefined,
      );

      await service.deactivateAssignment(assignmentId);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockManager.softDelete).toHaveBeenCalledWith(
        TeacherSchoolAssignmentEntity,
        assignmentId,
      );
      // Verify the cascade query to flag teaching assignments
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('pending_reassignment'),
        [teacherId, schoolBId],
      );
      expect(
        tokenInvalidationService.invalidateUserTokens,
      ).toHaveBeenCalledWith(teacherId);
    });

    it('should reject deactivation of primary assignment', async () => {
      assignmentEntityRepo.findOne.mockResolvedValue(mockPrimaryAssignment);

      await expect(
        service.deactivateAssignment('primary-assignment-uuid'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deactivateAssignment('primary-assignment-uuid'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'PRIMARY_ASSIGNMENT_REQUIRED',
        }),
      });
    });

    it('should throw when assignment does not exist', async () => {
      assignmentEntityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deactivateAssignment('non-existent-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should gracefully handle token invalidation failure', async () => {
      assignmentEntityRepo.findOne.mockResolvedValue(mockSecondaryAssignment);
      const mockManager = {
        softDelete: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue(undefined),
      };
      dataSource.transaction.mockImplementation(
        async (cb: TransactionCallback) => {
          return cb(mockManager as unknown as EntityManager);
        },
      );
      // Token invalidation fails
      tokenInvalidationService.invalidateUserTokens.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should not throw despite token invalidation failure
      await expect(
        service.deactivateAssignment(assignmentId),
      ).resolves.toBeUndefined();
    });
  });

  describe('getAccessibleSchoolIds()', () => {
    it('should return school IDs from active assignments', async () => {
      const activeAssignments = [
        {
          schoolId: schoolAId,
          role: AssignmentRole.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
        {
          schoolId: schoolBId,
          role: AssignmentRole.SECONDARY,
          status: AssignmentStatus.ACTIVE,
        },
      ] as TeacherSchoolAssignmentEntity[];

      assignmentRepository.findActiveByTeacher.mockResolvedValue(
        activeAssignments,
      );

      const result = await service.getAccessibleSchoolIds(teacherId);

      expect(result).toEqual([schoolAId, schoolBId]);
      expect(assignmentRepository.findActiveByTeacher).toHaveBeenCalledWith(
        teacherId,
      );
    });

    it('should fallback to teacher.schoolId when no assignment records exist', async () => {
      assignmentRepository.findActiveByTeacher.mockResolvedValue([]);
      teacherRepo.findOne.mockResolvedValue(mockTeacher);

      const result = await service.getAccessibleSchoolIds(teacherId);

      expect(result).toEqual([schoolAId]);
      expect(teacherRepo.findOne).toHaveBeenCalled();
    });

    it('should return empty array when no assignments and teacher not found', async () => {
      assignmentRepository.findActiveByTeacher.mockResolvedValue([]);
      teacherRepo.findOne.mockResolvedValue(null);

      const result = await service.getAccessibleSchoolIds(teacherId);

      expect(result).toEqual([]);
    });
  });

  describe('validateSameOrganization()', () => {
    it('should return true when both schools share the same parentSchoolId', async () => {
      schoolRepository.findById
        .mockResolvedValueOnce(mockSchoolA as SchoolEntity)
        .mockResolvedValueOnce(mockSchoolB as SchoolEntity);

      const result = await service.validateSameOrganization(
        schoolAId,
        schoolBId,
      );

      expect(result).toBe(true);
    });

    it('should return true when comparing the same school', async () => {
      const result = await service.validateSameOrganization(
        schoolAId,
        schoolAId,
      );

      expect(result).toBe(true);
    });

    it('should return false when schools belong to different organizations', async () => {
      schoolRepository.findById
        .mockResolvedValueOnce(mockSchoolA as SchoolEntity)
        .mockResolvedValueOnce(mockSchoolOtherOrg as SchoolEntity);

      const result = await service.validateSameOrganization(
        schoolAId,
        schoolOtherOrgId,
      );

      expect(result).toBe(false);
    });

    it('should return false when a school is not found', async () => {
      schoolRepository.findById
        .mockResolvedValueOnce(mockSchoolA as SchoolEntity)
        .mockResolvedValueOnce(null);

      const result = await service.validateSameOrganization(
        schoolAId,
        'non-existent',
      );

      expect(result).toBe(false);
    });

    it('should return true when one school is the organization root', async () => {
      // orgSchool has parentSchoolId = null, its id IS the orgId
      // schoolA has parentSchoolId = orgId
      schoolRepository.findById
        .mockResolvedValueOnce(mockOrgSchool as SchoolEntity)
        .mockResolvedValueOnce(mockSchoolA as SchoolEntity);

      const result = await service.validateSameOrganization(orgId, schoolAId);

      expect(result).toBe(true);
    });
  });

  describe('countSecondaryAssignments()', () => {
    it('should delegate to repository and return the count', async () => {
      assignmentRepository.countSecondaryByTeacher.mockResolvedValue(3);

      const result = await service.countSecondaryAssignments(teacherId);

      expect(result).toBe(3);
      expect(assignmentRepository.countSecondaryByTeacher).toHaveBeenCalledWith(
        teacherId,
      );
    });
  });

  describe('validateTeacherSchoolAccess()', () => {
    it('should return true when active assignment exists', async () => {
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.ACTIVE,
      } as TeacherSchoolAssignmentEntity);

      const result = await service.validateTeacherSchoolAccess(
        teacherId,
        schoolBId,
      );

      expect(result).toBe(true);
    });

    it('should return true when school is teacher primary school (fallback)', async () => {
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);
      teacherRepo.findOne.mockResolvedValue(mockTeacher);

      const result = await service.validateTeacherSchoolAccess(
        teacherId,
        schoolAId,
      );

      expect(result).toBe(true);
    });

    it('should return false when no assignment and not primary school', async () => {
      assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);
      teacherRepo.findOne.mockResolvedValue(mockTeacher);

      const result = await service.validateTeacherSchoolAccess(
        teacherId,
        schoolBId,
      );

      expect(result).toBe(false);
    });
  });

  describe('findByTeacher()', () => {
    it('should return active assignments by default', async () => {
      const assignments = [mockAssignment as TeacherSchoolAssignmentEntity];
      assignmentRepository.findActiveByTeacher.mockResolvedValue(assignments);

      const result = await service.findByTeacher(teacherId);

      expect(result).toEqual(assignments);
      expect(assignmentRepository.findActiveByTeacher).toHaveBeenCalledWith(
        teacherId,
      );
    });

    it('should return all assignments when includeInactive is true', async () => {
      const assignments = [mockAssignment as TeacherSchoolAssignmentEntity];
      assignmentRepository.findByTeacher.mockResolvedValue(assignments);

      const result = await service.findByTeacher(teacherId, true);

      expect(result).toEqual(assignments);
      expect(assignmentRepository.findByTeacher).toHaveBeenCalledWith(
        teacherId,
      );
    });
  });
});
