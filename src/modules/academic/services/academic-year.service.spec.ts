import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { AcademicYearEntity } from '../entities/academic-year.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';

describe('AcademicYearService', () => {
  let service: AcademicYearService;
  let repository: jest.Mocked<AcademicYearRepository>;

  const mockAcademicYear: AcademicYearEntity = {
    id: 'uuid-1',
    schoolId: 'school-uuid',
    name: '2025-2026',
    startDate: '2025-09-01',
    endDate: '2026-06-30',
    isCurrent: false,
    status: AcademicStatus.PLANNING,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    school: undefined as never,
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySchool: jest.fn(),
      findOverlapping: jest.fn(),
      create: jest.fn(),
      createWithTransaction: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearService,
        {
          provide: AcademicYearRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AcademicYearService>(AcademicYearService);
    repository = module.get(AcademicYearRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated academic years', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'DESC' as const };
      repository.findAll.mockResolvedValue([[mockAcademicYear], 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return an academic year by id', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);

      const result = await service.findById('uuid-1');

      expect(result).toEqual(mockAcademicYear);
      expect(repository.findById).toHaveBeenCalledWith('uuid-1');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create academic year without isCurrent', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
        isCurrent: false,
        status: AcademicStatus.PLANNING,
      };

      repository.findOverlapping.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAcademicYear);

      const result = await service.create(dto);

      expect(result).toEqual(mockAcademicYear);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.createWithTransaction).not.toHaveBeenCalled();
    });

    it('should use transaction when isCurrent is true', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
        isCurrent: true,
        status: AcademicStatus.PLANNING,
      };

      const currentYear = { ...mockAcademicYear, isCurrent: true };
      repository.findOverlapping.mockResolvedValue([]);
      repository.createWithTransaction.mockResolvedValue(currentYear);

      const result = await service.create(dto);

      expect(result.isCurrent).toBe(true);
      expect(repository.createWithTransaction).toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if startDate >= endDate', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2026-09-01',
        endDate: '2025-06-30',
        isCurrent: false,
        status: AcademicStatus.PLANNING,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if startDate equals endDate', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2025-09-01',
        isCurrent: false,
        status: AcademicStatus.PLANNING,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if dates overlap with existing year', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
        isCurrent: false,
        status: AcademicStatus.PLANNING,
      };

      repository.findOverlapping.mockResolvedValue([mockAcademicYear]);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Năm học bị trùng thời gian với năm học khác trong cùng trường',
      );
    });
  });

  describe('update', () => {
    it('should update an academic year', async () => {
      const dto = { name: 'Updated Name' };
      const updated = { ...mockAcademicYear, name: 'Updated Name' };

      repository.findById.mockResolvedValue(mockAcademicYear);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('uuid-1', dto);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if academic year not found during update', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if updated dates are invalid', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);

      await expect(
        service.update('uuid-1', { startDate: '2026-01-01', endDate: '2025-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if updated dates overlap with another year', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);
      repository.findOverlapping.mockResolvedValue([{ ...mockAcademicYear, id: 'uuid-2' }]);

      await expect(
        service.update('uuid-1', { startDate: '2025-09-01', endDate: '2026-06-30' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow update when no date overlap exists', async () => {
      const dto = { startDate: '2027-09-01', endDate: '2028-06-30' };
      const updated = { ...mockAcademicYear, ...dto };

      repository.findById.mockResolvedValue(mockAcademicYear);
      repository.findOverlapping.mockResolvedValue([]);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('uuid-1', dto);

      expect(result.startDate).toBe('2027-09-01');
      expect(result.endDate).toBe('2028-06-30');
    });
  });

  describe('remove', () => {
    it('should soft delete an academic year', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('uuid-1');

      expect(repository.softDelete).toHaveBeenCalledWith('uuid-1');
    });

    it('should throw NotFoundException if not found during delete', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
