import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GradeService } from './grade.service';
import { GradeRepository } from '../repositories/grade.repository';
import { GradeEntity } from '../entities/grade.entity';

describe('GradeService', () => {
  let service: GradeService;
  let repository: jest.Mocked<GradeRepository>;

  const schoolId = 'school-uuid';

  const mockGrade: GradeEntity = {
    id: 'grade-uuid',
    schoolId,
    name: 'Khối 10',
    level: 10,
    classes: [],
    school: undefined as never,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradeService,
        {
          provide: GradeRepository,
          useValue: {
            findBySchool: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GradeService>(GradeService);
    repository = module.get(GradeRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated grades for a school', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockGrade], 1]);

      const result = await service.findAll(schoolId, query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockGrade);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(repository.findAll).toHaveBeenCalledWith(schoolId, query);
    });

    it('should calculate totalPages correctly', async () => {
      const query = { page: 1, limit: 2, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockGrade, mockGrade], 5]);

      const result = await service.findAll(schoolId, query);

      expect(result.meta.totalPages).toBe(3);
    });

    it('should return empty data when no grades exist', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll(schoolId, query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return grade by id and schoolId', async () => {
      repository.findById.mockResolvedValue(mockGrade);

      const result = await service.findById('grade-uuid', schoolId);

      expect(result).toEqual(mockGrade);
      expect(repository.findById).toHaveBeenCalledWith('grade-uuid', schoolId);
    });

    it('should throw NotFoundException if grade not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with Vietnamese message', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent', schoolId)).rejects.toThrow(
        'Không tìm thấy khối',
      );
    });
  });

  describe('create', () => {
    it('should create a grade successfully with schoolId', async () => {
      const dto = { name: 'Khối 10', level: 10 };
      repository.create.mockResolvedValue(mockGrade);

      const result = await service.create(dto, schoolId);

      expect(result).toEqual(mockGrade);
      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        schoolId,
      });
    });

    it('should assign schoolId from context, not from dto', async () => {
      const dto = { name: 'Khối 11', level: 11 };
      const expectedGrade = { ...mockGrade, name: 'Khối 11', level: 11 };
      repository.create.mockResolvedValue(expectedGrade);

      await service.create(dto, schoolId);

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Khối 11',
        level: 11,
        schoolId,
      });
    });
  });

  describe('update', () => {
    it('should update a grade successfully', async () => {
      const dto = { name: 'Khối 11 cập nhật' };
      const updated = { ...mockGrade, name: 'Khối 11 cập nhật' };

      repository.findById.mockResolvedValue(mockGrade);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('grade-uuid', schoolId, dto);

      expect(result.name).toBe('Khối 11 cập nhật');
      expect(repository.findById).toHaveBeenCalledWith('grade-uuid', schoolId);
      expect(repository.update).toHaveBeenCalledWith('grade-uuid', dto);
    });

    it('should throw NotFoundException if grade not found during update', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', schoolId, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if repository.update returns null', async () => {
      repository.findById.mockResolvedValue(mockGrade);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update('grade-uuid', schoolId, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a grade successfully', async () => {
      repository.findById.mockResolvedValue(mockGrade);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('grade-uuid', schoolId);

      expect(repository.findById).toHaveBeenCalledWith('grade-uuid', schoolId);
      expect(repository.softDelete).toHaveBeenCalledWith('grade-uuid');
    });

    it('should throw NotFoundException if grade not found during remove', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
