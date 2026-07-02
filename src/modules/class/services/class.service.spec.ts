import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ClassService } from './class.service';
import { ClassRepository } from '../repositories/class.repository';
import { ClassEntity } from '../entities/class.entity';
import { EntityStatus } from '../../../common/enums/status.enum';

describe('ClassService', () => {
  let service: ClassService;
  let repository: jest.Mocked<ClassRepository>;

  const mockClass: ClassEntity = {
    id: 'class-uuid-1',
    schoolId: 'school-uuid',
    gradeId: 'grade-uuid',
    academicYearId: 'year-uuid',
    name: '10A1',
    homeroomTeacherId: null,
    studentCount: 35,
    status: EntityStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    school: undefined as never,
    grade: undefined as never,
    academicYear: undefined as never,
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNameInGradeAndYear: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassService,
        { provide: ClassRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ClassService>(ClassService);
    repository = module.get(ClassRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated classes', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockClass], 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return a class by id', async () => {
      repository.findById.mockResolvedValue(mockClass);

      const result = await service.findById('class-uuid-1');

      expect(result).toEqual(mockClass);
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a class when name is unique in grade+year', async () => {
      const dto = {
        schoolId: 'school-uuid',
        gradeId: 'grade-uuid',
        academicYearId: 'year-uuid',
        name: '10A1',
      };

      repository.findByNameInGradeAndYear.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockClass);

      const result = await service.create(dto);

      expect(result).toEqual(mockClass);
      expect(repository.findByNameInGradeAndYear).toHaveBeenCalledWith(
        'grade-uuid',
        'year-uuid',
        '10A1',
      );
    });

    it('should throw BadRequestException if name already exists in same grade+year', async () => {
      const dto = {
        schoolId: 'school-uuid',
        gradeId: 'grade-uuid',
        academicYearId: 'year-uuid',
        name: '10A1',
      };

      repository.findByNameInGradeAndYear.mockResolvedValue(mockClass);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should allow same name in different grade', async () => {
      const dto = {
        schoolId: 'school-uuid',
        gradeId: 'different-grade-uuid',
        academicYearId: 'year-uuid',
        name: '10A1',
      };

      repository.findByNameInGradeAndYear.mockResolvedValue(null);
      repository.create.mockResolvedValue({ ...mockClass, gradeId: 'different-grade-uuid' });

      const result = await service.create(dto);

      expect(result.gradeId).toBe('different-grade-uuid');
    });

    it('should allow same name in different academic year', async () => {
      const dto = {
        schoolId: 'school-uuid',
        gradeId: 'grade-uuid',
        academicYearId: 'different-year-uuid',
        name: '10A1',
      };

      repository.findByNameInGradeAndYear.mockResolvedValue(null);
      repository.create.mockResolvedValue({ ...mockClass, academicYearId: 'different-year-uuid' });

      const result = await service.create(dto);

      expect(result.academicYearId).toBe('different-year-uuid');
    });
  });

  describe('update', () => {
    it('should update a class', async () => {
      const dto = { name: '10A2' };
      const updated = { ...mockClass, name: '10A2' };

      repository.findById.mockResolvedValue(mockClass);
      repository.findByNameInGradeAndYear.mockResolvedValue(null);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('class-uuid-1', dto);

      expect(result.name).toBe('10A2');
    });

    it('should throw BadRequestException if updated name conflicts with existing class', async () => {
      const dto = { name: '10A2' };
      const existingOther: ClassEntity = { ...mockClass, id: 'class-uuid-2', name: '10A2' };

      repository.findById.mockResolvedValue(mockClass);
      repository.findByNameInGradeAndYear.mockResolvedValue(existingOther);

      await expect(service.update('class-uuid-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should allow updating to same name (same entity)', async () => {
      const dto = { name: '10A1' };

      repository.findById.mockResolvedValue(mockClass);
      repository.findByNameInGradeAndYear.mockResolvedValue(mockClass); // same entity
      repository.update.mockResolvedValue(mockClass);

      const result = await service.update('class-uuid-1', dto);

      expect(result.name).toBe('10A1');
    });

    it('should throw NotFoundException if class not found during update', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate uniqueness with new gradeId when provided', async () => {
      const dto = { name: '10A1', gradeId: 'new-grade-uuid' };

      repository.findById.mockResolvedValue(mockClass);
      repository.findByNameInGradeAndYear.mockResolvedValue(null);
      repository.update.mockResolvedValue({ ...mockClass, gradeId: 'new-grade-uuid' });

      await service.update('class-uuid-1', dto);

      expect(repository.findByNameInGradeAndYear).toHaveBeenCalledWith(
        'new-grade-uuid',
        'year-uuid',
        '10A1',
      );
    });

    it('should validate uniqueness with new academicYearId when provided', async () => {
      const dto = { name: '10A1', academicYearId: 'new-year-uuid' };

      repository.findById.mockResolvedValue(mockClass);
      repository.findByNameInGradeAndYear.mockResolvedValue(null);
      repository.update.mockResolvedValue({ ...mockClass, academicYearId: 'new-year-uuid' });

      await service.update('class-uuid-1', dto);

      expect(repository.findByNameInGradeAndYear).toHaveBeenCalledWith(
        'grade-uuid',
        'new-year-uuid',
        '10A1',
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a class', async () => {
      repository.findById.mockResolvedValue(mockClass);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('class-uuid-1');

      expect(repository.softDelete).toHaveBeenCalledWith('class-uuid-1');
    });

    it('should throw NotFoundException if not found during delete', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
