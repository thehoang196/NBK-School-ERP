import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TeachingAssignmentService } from '../../../src/modules/teaching-assignment/teaching-assignment.service';
import { TeachingAssignmentRepository } from '../../../src/modules/teaching-assignment/teaching-assignment.repository';
import { TeachingAssignmentEntity } from '../../../src/modules/teaching-assignment/entities/teaching-assignment.entity';
import { TeacherEntity } from '../../../src/modules/teacher/entities/teacher.entity';
import { ClassEntity } from '../../../src/modules/class/entities/class.entity';
import { TeacherSubjectService } from '../../../src/modules/teacher/teacher-subject.service';
import { TeacherSchoolAssignmentService } from '../../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { WorkloadStatus } from '../../../src/modules/teaching-assignment/dto/workload-response.dto';

type TransactionCallback = (entityManager: EntityManager) => Promise<unknown>;

describe('TeachingAssignmentService', () => {
  let service: TeachingAssignmentService;
  let repository: jest.Mocked<TeachingAssignmentRepository>;
  let dataSource: { transaction: jest.Mock };
  let teacherRepo: { findOne: jest.Mock; find: jest.Mock };
  let classRepo: { findOne: jest.Mock };
  let teacherSchoolAssignmentService: {
    validateTeacherSchoolAccess: jest.Mock;
  };

  const mockTeacher: Partial<TeacherEntity> = {
    id: 'teacher-uuid-1',
    fullName: 'Nguyễn Thị Mai',
    maxPeriodsPerWeek: 20,
    minPeriodsPerWeek: 12,
    deletedAt: null,
  };

  const mockAssignment: Partial<TeachingAssignmentEntity> = {
    id: 'assignment-uuid-1',
    semesterId: 'semester-uuid-1',
    teacherId: 'teacher-uuid-1',
    classId: 'class-uuid-1',
    subjectId: 'subject-uuid-1',
    schoolId: 'school-uuid-1',
    assignmentStatus: 'active',
    periodsPerWeek: 4,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySemester: jest.fn(),
      findByTeacher: jest.fn(),
      sumPeriodsByTeacher: jest.fn(),
      checkDuplicate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getRepository: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    teacherRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    classRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'class-uuid-1',
        schoolId: 'school-uuid-1',
        deletedAt: null,
      }),
    };

    teacherSchoolAssignmentService = {
      validateTeacherSchoolAccess: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachingAssignmentService,
        {
          provide: TeachingAssignmentRepository,
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: teacherRepo,
        },
        {
          provide: getRepositoryToken(ClassEntity),
          useValue: classRepo,
        },
        {
          provide: TeacherSubjectService,
          useValue: {
            hasAssignment: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: TeacherSchoolAssignmentService,
          useValue: teacherSchoolAssignmentService,
        },
      ],
    }).compile();

    service = module.get<TeachingAssignmentService>(TeachingAssignmentService);
    repository = module.get(TeachingAssignmentRepository);
    dataSource = module.get<DataSource>(DataSource) as unknown as {
      transaction: jest.Mock;
    };
  });

  describe('create()', () => {
    it('should create a teaching assignment successfully', async () => {
      repository.checkDuplicate.mockResolvedValue(null);
      repository.create.mockResolvedValue(
        mockAssignment as TeachingAssignmentEntity,
      );

      const dto = {
        semesterId: 'semester-uuid-1',
        teacherId: 'teacher-uuid-1',
        classId: 'class-uuid-1',
        subjectId: 'subject-uuid-1',
        periodsPerWeek: 4,
      };

      const result = await service.create(dto);

      expect(result).toEqual(mockAssignment);
      expect(repository.checkDuplicate).toHaveBeenCalledWith(
        dto.semesterId,
        dto.teacherId,
        dto.classId,
        dto.subjectId,
        undefined,
      );
      expect(repository.create).toHaveBeenCalledWith({
        semesterId: dto.semesterId,
        teacherId: dto.teacherId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        schoolId: 'school-uuid-1',
        assignmentStatus: 'active',
        periodsPerWeek: dto.periodsPerWeek,
        note: null,
      });
    });

    it('should throw ConflictException when duplicate exists', async () => {
      repository.checkDuplicate.mockResolvedValue(
        mockAssignment as TeachingAssignmentEntity,
      );

      const dto = {
        semesterId: 'semester-uuid-1',
        teacherId: 'teacher-uuid-1',
        classId: 'class-uuid-1',
        subjectId: 'subject-uuid-1',
        periodsPerWeek: 4,
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should handle optional note field', async () => {
      repository.checkDuplicate.mockResolvedValue(null);
      const assignmentWithNote = {
        ...mockAssignment,
        note: 'Ghi chú phân công',
      };
      repository.create.mockResolvedValue(
        assignmentWithNote as TeachingAssignmentEntity,
      );

      const dto = {
        semesterId: 'semester-uuid-1',
        teacherId: 'teacher-uuid-1',
        classId: 'class-uuid-1',
        subjectId: 'subject-uuid-1',
        periodsPerWeek: 4,
        note: 'Ghi chú phân công',
      };

      const result = await service.create(dto);

      expect(result.note).toBe('Ghi chú phân công');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'Ghi chú phân công' }),
      );
    });
  });

  describe('update()', () => {
    it('should update a teaching assignment successfully', async () => {
      repository.findById.mockResolvedValue(
        mockAssignment as TeachingAssignmentEntity,
      );
      repository.checkDuplicate.mockResolvedValue(null);
      const updatedAssignment = { ...mockAssignment, periodsPerWeek: 5 };
      repository.update.mockResolvedValue(
        updatedAssignment as TeachingAssignmentEntity,
      );

      const dto = { periodsPerWeek: 5 };
      const result = await service.update('assignment-uuid-1', dto);

      expect(result.periodsPerWeek).toBe(5);
      expect(repository.checkDuplicate).toHaveBeenCalledWith(
        mockAssignment.semesterId,
        mockAssignment.teacherId,
        mockAssignment.classId,
        mockAssignment.subjectId,
        'assignment-uuid-1',
      );
    });

    it('should validate duplicate when changing teacher/class/subject', async () => {
      repository.findById.mockResolvedValue(
        mockAssignment as TeachingAssignmentEntity,
      );
      repository.checkDuplicate.mockResolvedValue(
        mockAssignment as TeachingAssignmentEntity,
      );

      const dto = { teacherId: 'teacher-uuid-2' };

      await expect(service.update('assignment-uuid-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const dto = { periodsPerWeek: 5 };

      await expect(service.update('non-existent-uuid', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('should soft delete a teaching assignment', async () => {
      repository.findById.mockResolvedValue(
        mockAssignment as TeachingAssignmentEntity,
      );
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('assignment-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith('assignment-uuid-1');
      expect(repository.softDelete).toHaveBeenCalledWith('assignment-uuid-1');
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkCreate()', () => {
    it('should create multiple assignments successfully', async () => {
      const assignments = [
        {
          semesterId: 'semester-uuid-1',
          teacherId: 'teacher-uuid-1',
          classId: 'class-uuid-1',
          subjectId: 'subject-uuid-1',
          periodsPerWeek: 4,
        },
        {
          semesterId: 'semester-uuid-1',
          teacherId: 'teacher-uuid-2',
          classId: 'class-uuid-1',
          subjectId: 'subject-uuid-2',
          periodsPerWeek: 3,
        },
      ];

      const savedEntities = assignments.map((a, i) => ({
        id: `assignment-uuid-${i + 1}`,
        ...a,
        schoolId: 'school-uuid-1',
        assignmentStatus: 'active',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }));

      const mockManager = {
        findOne: jest.fn().mockImplementation((entity: unknown) => {
          // ClassEntity lookup should return a class with schoolId
          if (entity === ClassEntity) {
            return Promise.resolve({
              id: 'class-uuid-1',
              schoolId: 'school-uuid-1',
              deletedAt: null,
            });
          }
          // TeachingAssignmentEntity duplicate check should return null (no duplicate)
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest
          .fn()
          .mockImplementation((data) =>
            savedEntities.find((e) => e.teacherId === data.teacherId),
          ),
      } as unknown as EntityManager;

      dataSource.transaction.mockImplementation(
        async (cb: TransactionCallback) => {
          return cb(mockManager);
        },
      );

      const result = await service.bulkCreate({ assignments });

      expect(result).toHaveLength(2);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException on duplicate in bulk', async () => {
      const assignments = [
        {
          semesterId: 'semester-uuid-1',
          teacherId: 'teacher-uuid-1',
          classId: 'class-uuid-1',
          subjectId: 'subject-uuid-1',
          periodsPerWeek: 4,
        },
      ];

      const mockManager = {
        findOne: jest.fn().mockImplementation((entity: unknown) => {
          if (entity === ClassEntity) {
            return Promise.resolve({
              id: 'class-uuid-1',
              schoolId: 'school-uuid-1',
              deletedAt: null,
            });
          }
          // Return a duplicate for TeachingAssignmentEntity
          return Promise.resolve(mockAssignment);
        }),
        create: jest.fn(),
        save: jest.fn(),
      } as unknown as EntityManager;

      dataSource.transaction.mockImplementation(
        async (cb: TransactionCallback) => {
          return cb(mockManager);
        },
      );

      await expect(service.bulkCreate({ assignments })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('copyFromPreviousSemester()', () => {
    it('should copy assignments from source semester', async () => {
      const sourceAssignments = [
        {
          ...mockAssignment,
          id: 'source-1',
          semesterId: 'source-semester-uuid',
        },
        {
          ...mockAssignment,
          id: 'source-2',
          semesterId: 'source-semester-uuid',
          teacherId: 'teacher-uuid-2',
          subjectId: 'subject-uuid-2',
        },
      ] as TeachingAssignmentEntity[];

      repository.findBySemester.mockResolvedValue(sourceAssignments);

      const copiedEntities = sourceAssignments.map((a, i) => ({
        ...a,
        id: `copied-${i + 1}`,
        semesterId: 'target-semester-uuid',
      }));

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((data, index) => {
          const idx = copiedEntities.findIndex(
            (e) => e.teacherId === data.teacherId,
          );
          return copiedEntities[idx >= 0 ? idx : 0];
        }),
      } as unknown as EntityManager;

      dataSource.transaction.mockImplementation(
        async (cb: TransactionCallback) => {
          return cb(mockManager);
        },
      );

      const dto = {
        sourceSemesterId: 'source-semester-uuid',
        targetSemesterId: 'target-semester-uuid',
      };

      const result = await service.copyFromPreviousSemester(dto);

      expect(result).toHaveLength(2);
      expect(repository.findBySemester).toHaveBeenCalledWith(
        'source-semester-uuid',
      );
    });

    it('should skip duplicates that already exist in target semester', async () => {
      const sourceAssignments = [
        {
          ...mockAssignment,
          id: 'source-1',
          semesterId: 'source-semester-uuid',
        },
      ] as TeachingAssignmentEntity[];

      repository.findBySemester.mockResolvedValue(sourceAssignments);

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(mockAssignment), // Already exists
        create: jest.fn(),
        save: jest.fn(),
      } as unknown as EntityManager;

      dataSource.transaction.mockImplementation(
        async (cb: TransactionCallback) => {
          return cb(mockManager);
        },
      );

      const dto = {
        sourceSemesterId: 'source-semester-uuid',
        targetSemesterId: 'target-semester-uuid',
      };

      const result = await service.copyFromPreviousSemester(dto);

      expect(result).toHaveLength(0);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when no source assignments found', async () => {
      repository.findBySemester.mockResolvedValue([]);

      const dto = {
        sourceSemesterId: 'empty-semester-uuid',
        targetSemesterId: 'target-semester-uuid',
      };

      await expect(service.copyFromPreviousSemester(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkWorkload()', () => {
    it('should return NORMAL status when periods within range', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher as TeacherEntity);
      repository.sumPeriodsByTeacher.mockResolvedValue(15);

      const result = await service.checkWorkload(
        'teacher-uuid-1',
        'semester-uuid-1',
      );

      expect(result.workloadStatus).toBe(WorkloadStatus.NORMAL);
      expect(result.totalPeriods).toBe(15);
      expect(result.teacherId).toBe('teacher-uuid-1');
      expect(result.teacherName).toBe('Nguyễn Thị Mai');
    });

    it('should return OVER status when periods exceed max', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher as TeacherEntity);
      repository.sumPeriodsByTeacher.mockResolvedValue(25);

      const result = await service.checkWorkload(
        'teacher-uuid-1',
        'semester-uuid-1',
      );

      expect(result.workloadStatus).toBe(WorkloadStatus.OVER);
      expect(result.totalPeriods).toBe(25);
    });

    it('should return UNDER status when periods below min', async () => {
      teacherRepo.findOne.mockResolvedValue(mockTeacher as TeacherEntity);
      repository.sumPeriodsByTeacher.mockResolvedValue(5);

      const result = await service.checkWorkload(
        'teacher-uuid-1',
        'semester-uuid-1',
      );

      expect(result.workloadStatus).toBe(WorkloadStatus.UNDER);
      expect(result.totalPeriods).toBe(5);
    });
  });

  describe('checkAllWorkloads()', () => {
    it('should return workload status for all teachers', async () => {
      const teachers = [
        { ...mockTeacher, id: 'teacher-uuid-1', fullName: 'Nguyễn Thị Mai' },
        { ...mockTeacher, id: 'teacher-uuid-2', fullName: 'Trần Văn Hùng' },
      ] as TeacherEntity[];

      teacherRepo.find.mockResolvedValue(teachers);
      repository.sumPeriodsByTeacher
        .mockResolvedValueOnce(15) // Normal for teacher 1
        .mockResolvedValueOnce(25); // Over for teacher 2

      const result = await service.checkAllWorkloads('semester-uuid-1');

      expect(result).toHaveLength(2);
      expect(result[0].workloadStatus).toBe(WorkloadStatus.NORMAL);
      expect(result[1].workloadStatus).toBe(WorkloadStatus.OVER);
    });
  });

  describe('findAll()', () => {
    it('should return paginated results', async () => {
      const assignments = [mockAssignment as TeachingAssignmentEntity];
      repository.findAll.mockResolvedValue([assignments, 1]);

      const query = { page: 1, limit: 20, sortOrder: 'ASC' as const };
      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findById()', () => {
    it('should return assignment when found', async () => {
      repository.findById.mockResolvedValue(
        mockAssignment as TeachingAssignmentEntity,
      );

      const result = await service.findById('assignment-uuid-1');

      expect(result).toEqual(mockAssignment);
      expect(repository.findById).toHaveBeenCalledWith('assignment-uuid-1');
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
