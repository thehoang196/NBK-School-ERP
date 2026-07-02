import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubjectService } from './subject.service';
import { SubjectRepository } from './subject.repository';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectGradeEntity } from './entities/subject-grade.entity';
import { SubjectType, RoomType } from '../../common/enums/status.enum';

describe('SubjectService', () => {
  let service: SubjectService;
  let subjectRepository: jest.Mocked<SubjectRepository>;
  let subjectGradeRepo: jest.Mocked<Repository<SubjectGradeEntity>>;

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
    school: undefined as never,
  };

  const mockSubjectGrade: SubjectGradeEntity = {
    id: 'sg-uuid',
    subjectId: 'subject-uuid',
    gradeId: 'grade-uuid',
    periodsPerWeek: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    subject: undefined as never,
    grade: undefined as never,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectService,
        {
          provide: SubjectRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByCode: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SubjectGradeEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubjectService>(SubjectService);
    subjectRepository = module.get(SubjectRepository);
    subjectGradeRepo = module.get(getRepositoryToken(SubjectGradeEntity));
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
    });
  });

  describe('create', () => {
    it('should create a subject when code is unique', async () => {
      const dto = { schoolId: 'school-uuid', code: 'TOAN', name: 'Toán' };
      subjectRepository.findByCode.mockResolvedValue(null);
      subjectRepository.create.mockResolvedValue(mockSubject);

      const result = await service.create(dto);
      expect(result).toEqual(mockSubject);
    });

    it('should throw BadRequestException if code already exists', async () => {
      const dto = { schoolId: 'school-uuid', code: 'TOAN', name: 'Toán' };
      subjectRepository.findByCode.mockResolvedValue(mockSubject);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignPeriodsPerGrade', () => {
    it('should create new subject-grade assignment', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectGradeRepo.findOne.mockResolvedValue(null);
      subjectGradeRepo.create.mockReturnValue(mockSubjectGrade);
      subjectGradeRepo.save.mockResolvedValue(mockSubjectGrade);

      const result = await service.assignPeriodsPerGrade({
        subjectId: 'subject-uuid',
        gradeId: 'grade-uuid',
        periodsPerWeek: 5,
      });

      expect(result.periodsPerWeek).toBe(5);
    });

    it('should update existing subject-grade assignment', async () => {
      const existing = { ...mockSubjectGrade, periodsPerWeek: 3 };
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectGradeRepo.findOne.mockResolvedValue(existing);
      subjectGradeRepo.save.mockResolvedValue({ ...existing, periodsPerWeek: 5 });

      const result = await service.assignPeriodsPerGrade({
        subjectId: 'subject-uuid',
        gradeId: 'grade-uuid',
        periodsPerWeek: 5,
      });

      expect(result.periodsPerWeek).toBe(5);
    });

    it('should throw NotFoundException if subject not found', async () => {
      subjectRepository.findById.mockResolvedValue(null);

      await expect(
        service.assignPeriodsPerGrade({
          subjectId: 'nonexistent',
          gradeId: 'grade-uuid',
          periodsPerWeek: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a subject', async () => {
      subjectRepository.findById.mockResolvedValue(mockSubject);
      subjectRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('subject-uuid');
      expect(subjectRepository.softDelete).toHaveBeenCalledWith('subject-uuid');
    });
  });
});
