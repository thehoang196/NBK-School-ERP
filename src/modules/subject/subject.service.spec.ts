import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SubjectService } from './subject.service';
import { SubjectRepository } from './subject.repository';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectGradeEntity } from './entities/subject-grade.entity';
import { DuplicateSubjectCodeException } from './exceptions/duplicate-subject-code.exception';
import { SubjectType, RoomType } from '../../common/enums/status.enum';

describe('SubjectService', () => {
  let service: SubjectService;
  let subjectRepository: jest.Mocked<SubjectRepository>;
  let dataSource: jest.Mocked<DataSource>;

  const mockSubject: SubjectEntity = {
    id: 'subject-uuid',
    schoolId: 'school-uuid',
    code: 'TOAN',
    name: 'Toán',
    shortName: 'T',
    subjectType: SubjectType.REQUIRED,
    periodsPerWeek: 4,
    requiresRoomType: RoomType.STANDARD,
    colorCode: '#FF5733',
    isDoublePeriod: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
    subjectGrades: [],
  };

  const mockSubjectGrade: SubjectGradeEntity = {
    id: 'sg-uuid',
    subjectId: 'subject-uuid',
    gradeId: 'grade-uuid',
    periodsPerWeek: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    subject: undefined as never,
    grade: undefined as never,
  };

  // Mock transaction: calls the callback with a mock manager
  const mockManager = {
    getRepository: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const mockTransaction = jest.fn().mockImplementation(async (cb) => {
      return cb(mockManager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectService,
        {
          provide: SubjectRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByCode: jest.fn(),
            findBySchool: jest.fn(),
            countBySchool: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            findGradesBySubject: jest.fn(),
            findSubjectsByGrade: jest.fn(),
            upsertSubjectGrade: jest.fn(),
            deleteSubjectGrade: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: mockTransaction,
          },
        },
      ],
    }).compile();

    service = module.get<SubjectService>(SubjectService);
    subjectRepository = module.get(SubjectRepository);
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated subjects', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      subjectRepository.findAll.mockResolvedValue([[mockSubject], 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      const query = { page: 1, limit: 5, sortOrder: 'ASC' as const };
      subjectRepository.findAll.mockResolvedValue([[mockSubject], 12]);

      const result = await service.findAll(query);

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findById', () => {
    it('should return subject when found', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);

      const result = await service.findById('subject-uuid');
      expect(result).toEqual(mockSubject);
    });

    it('should throw NotFoundException when subject not found', async () => {
      subjectRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when schoolId does not match', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);

      await expect(
        service.findById('subject-uuid', 'other-school'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create subject with transaction when code is unique', async () => {
      const dto = { schoolId: 'school-uuid', code: 'TOAN', name: 'Toán' };
      subjectRepository.findByCode.mockResolvedValue(null);
      subjectRepository.countBySchool.mockResolvedValue(0);

      const mockSubjectRepo = {
        create: jest.fn().mockReturnValue(mockSubject),
        save: jest.fn().mockResolvedValue(mockSubject),
      };
      mockManager.getRepository.mockReturnValue(mockSubjectRepo);

      const result = await service.create(dto);

      expect(result).toEqual(mockSubject);
      expect(subjectRepository.findByCode).toHaveBeenCalledWith(
        'school-uuid',
        'TOAN',
      );
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should throw DuplicateSubjectCodeException if code already exists', async () => {
      const dto = { schoolId: 'school-uuid', code: 'TOAN', name: 'Toán' };
      subjectRepository.findByCode.mockResolvedValue(mockSubject);

      await expect(service.create(dto)).rejects.toThrow(
        DuplicateSubjectCodeException,
      );
    });

    it('should create subject with subjectGrades in same transaction', async () => {
      const dto = {
        schoolId: 'school-uuid',
        code: 'LY',
        name: 'Vật Lý',
        subjectGrades: [
          { gradeId: 'grade-10', periodsPerWeek: 3 },
          { gradeId: 'grade-11', periodsPerWeek: 4 },
        ],
      };
      subjectRepository.findByCode.mockResolvedValue(null);
      subjectRepository.countBySchool.mockResolvedValue(5);

      const mockSubjectRepo = {
        create: jest
          .fn()
          .mockReturnValue({ ...mockSubject, id: 'new-subject-id' }),
        save: jest
          .fn()
          .mockResolvedValue({ ...mockSubject, id: 'new-subject-id' }),
      };
      const mockSubjectGradeRepo = {
        create: jest.fn().mockImplementation((data) => data),
        save: jest.fn().mockResolvedValue([]),
      };

      mockManager.getRepository.mockImplementation((entity) => {
        if (entity === SubjectEntity) return mockSubjectRepo;
        if (entity === SubjectGradeEntity) return mockSubjectGradeRepo;
        return {};
      });

      await service.create(dto);

      expect(mockSubjectGradeRepo.create).toHaveBeenCalledTimes(2);
      expect(mockSubjectGradeRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update subject successfully', async () => {
      const updatedSubject = { ...mockSubject, name: 'Toán Cao Cấp' };
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.update.mockResolvedValue(updatedSubject);

      const result = await service.update('subject-uuid', {
        name: 'Toán Cao Cấp',
      });
      expect(result.name).toBe('Toán Cao Cấp');
    });

    it('should throw DuplicateSubjectCodeException if code conflicts on update', async () => {
      const anotherSubject = { ...mockSubject, id: 'another-uuid', code: 'LY' };
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.findByCode.mockResolvedValue(anotherSubject);

      await expect(
        service.update('subject-uuid', { code: 'LY' }),
      ).rejects.toThrow(DuplicateSubjectCodeException);
    });

    it('should allow updating code to the same value', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.findByCode.mockResolvedValue(mockSubject);
      subjectRepository.update.mockResolvedValue(mockSubject);

      // Code same as current → should not throw
      const result = await service.update('subject-uuid', { code: 'TOAN' });
      expect(result).toEqual(mockSubject);
    });

    it('should throw NotFoundException if subject not found', async () => {
      subjectRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a subject', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.softDelete.mockResolvedValue(undefined);

      await service.softDelete('subject-uuid');
      expect(subjectRepository.softDelete).toHaveBeenCalledWith('subject-uuid');
    });

    it('should throw NotFoundException if subject does not exist', async () => {
      subjectRepository.findById.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if schoolId does not match', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);

      await expect(
        service.softDelete('subject-uuid', 'other-school'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertSubjectGrade', () => {
    it('should upsert subject grade successfully', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.upsertSubjectGrade.mockResolvedValue(mockSubjectGrade);

      const result = await service.upsertSubjectGrade(
        'subject-uuid',
        'grade-uuid',
        5,
      );
      expect(result.periodsPerWeek).toBe(5);
    });

    it('should throw NotFoundException if subject not found', async () => {
      subjectRepository.findById.mockResolvedValue(null);

      await expect(
        service.upsertSubjectGrade('nonexistent', 'grade-uuid', 5),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubjectGrades', () => {
    it('should return subject grades list', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.findGradesBySubject.mockResolvedValue([
        mockSubjectGrade,
      ]);

      const result = await service.getSubjectGrades('subject-uuid');
      expect(result).toHaveLength(1);
      expect(result[0].periodsPerWeek).toBe(5);
    });
  });

  describe('removeSubjectGrade', () => {
    it('should remove subject grade', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.deleteSubjectGrade.mockResolvedValue(undefined);

      await service.removeSubjectGrade('subject-uuid', 'grade-uuid');
      expect(subjectRepository.deleteSubjectGrade).toHaveBeenCalledWith(
        'subject-uuid',
        'grade-uuid',
      );
    });
  });

  describe('bulkUpsertSubjectGrades', () => {
    it('should upsert multiple grades in transaction', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);

      const mockSGRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation((data) => ({ ...mockSubjectGrade, ...data })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      mockManager.getRepository.mockReturnValue(mockSGRepo);

      const grades = [
        { gradeId: 'grade-10', periodsPerWeek: 3 },
        { gradeId: 'grade-11', periodsPerWeek: 4 },
      ];

      const result = await service.bulkUpsertSubjectGrades(
        'subject-uuid',
        grades,
      );
      expect(result).toHaveLength(2);
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });
});
