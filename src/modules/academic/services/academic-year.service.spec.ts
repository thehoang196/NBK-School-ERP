import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AcademicYearService } from './academic-year.service';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { AcademicYearEntity } from '../entities/academic-year.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';
import { InvalidStatusTransitionException } from '../exceptions/invalid-status-transition.exception';
import { AcademicYearOverlapException } from '../exceptions/academic-year-overlap.exception';
import { AcademicYearDateConflictException } from '../exceptions/academic-year-date-conflict.exception';

describe('AcademicYearService', () => {
  let service: AcademicYearService;
  let repository: jest.Mocked<AcademicYearRepository>;
  let dataSource: jest.Mocked<DataSource>;

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
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
    semesters: [],
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySchool: jest.fn(),
      findCurrent: jest.fn(),
      findOverlapping: jest.fn(),
      create: jest.fn(),
      createWithTransaction: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearService,
        {
          provide: AcademicYearRepository,
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AcademicYearService>(AcademicYearService);
    repository = module.get(AcademicYearRepository);
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated academic years', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'DESC' as const };
      repository.findAll.mockResolvedValue([[mockAcademicYear], 1]);

      const result = await service.findAll('school-uuid', query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(repository.findAll).toHaveBeenCalledWith('school-uuid', query);
    });

    it('should pass status filter to repository', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'DESC' as const,
        status: AcademicStatus.ACTIVE,
      };
      repository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll('school-uuid', query);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(repository.findAll).toHaveBeenCalledWith('school-uuid', query);
    });

    it('should pass isCurrent filter to repository', async () => {
      const currentYear = { ...mockAcademicYear, isCurrent: true };
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'DESC' as const,
        isCurrent: true,
      };
      repository.findAll.mockResolvedValue([[currentYear], 1]);

      const result = await service.findAll('school-uuid', query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].isCurrent).toBe(true);
      expect(repository.findAll).toHaveBeenCalledWith('school-uuid', query);
    });

    it('should calculate totalPages correctly with multiple pages', async () => {
      const query = { page: 2, limit: 5, sortOrder: 'DESC' as const };
      repository.findAll.mockResolvedValue([[mockAcademicYear], 12]);

      const result = await service.findAll('school-uuid', query);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.total).toBe(12);
      expect(result.meta.totalPages).toBe(3); // Math.ceil(12/5) = 3
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

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with Vietnamese message', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        'Không tìm thấy năm học',
      );
    });
  });

  describe('findBySchool', () => {
    it('should return academic years for a school', async () => {
      repository.findBySchool.mockResolvedValue([mockAcademicYear]);

      const result = await service.findBySchool('school-uuid');

      expect(result).toEqual([mockAcademicYear]);
      expect(repository.findBySchool).toHaveBeenCalledWith('school-uuid');
    });

    it('should return empty array when school has no academic years', async () => {
      repository.findBySchool.mockResolvedValue([]);

      const result = await service.findBySchool('school-uuid');

      expect(result).toEqual([]);
      expect(repository.findBySchool).toHaveBeenCalledWith('school-uuid');
    });

    it('should return multiple academic years ordered by school', async () => {
      const secondYear = {
        ...mockAcademicYear,
        id: 'uuid-2',
        name: '2024-2025',
      };
      repository.findBySchool.mockResolvedValue([mockAcademicYear, secondYear]);

      const result = await service.findBySchool('school-uuid');

      expect(result).toHaveLength(2);
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

    it('should throw AcademicYearDateConflictException if startDate >= endDate', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2026-09-01',
        endDate: '2025-06-30',
        isCurrent: false,
        status: AcademicStatus.PLANNING,
      };

      await expect(service.create(dto)).rejects.toThrow(
        AcademicYearDateConflictException,
      );
    });

    it('should throw AcademicYearDateConflictException if startDate equals endDate', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2025-09-01',
        isCurrent: false,
        status: AcademicStatus.PLANNING,
      };

      await expect(service.create(dto)).rejects.toThrow(
        AcademicYearDateConflictException,
      );
    });

    it('should throw AcademicYearOverlapException if dates overlap with existing year', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
        isCurrent: false,
        status: AcademicStatus.PLANNING,
      };

      repository.findOverlapping.mockResolvedValue([mockAcademicYear]);

      await expect(service.create(dto)).rejects.toThrow(
        AcademicYearOverlapException,
      );
    });
  });

  describe('setCurrent', () => {
    it('should set academic year as current within a transaction', async () => {
      const currentYear = { ...mockAcademicYear, isCurrent: true };
      repository.findById.mockResolvedValueOnce(mockAcademicYear);

      // Mock transaction to execute the callback
      dataSource.transaction.mockImplementation(async (cb: unknown) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({}),
          }),
        };
        return (cb as (manager: typeof mockManager) => Promise<void>)(
          mockManager,
        );
      });

      // After transaction, findById returns the updated entity
      repository.findById.mockResolvedValueOnce(currentYear);

      const result = await service.setCurrent('uuid-1', 'school-uuid');

      expect(result.isCurrent).toBe(true);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if academic year not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.setCurrent('nonexistent', 'school-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if academic year belongs to different school', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);

      await expect(
        service.setCurrent('uuid-1', 'different-school'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('transitionStatus', () => {
    it('should transition from planning to active', async () => {
      const planningYear = {
        ...mockAcademicYear,
        status: AcademicStatus.PLANNING,
      };
      const activeYear = { ...mockAcademicYear, status: AcademicStatus.ACTIVE };

      repository.findById.mockResolvedValue(planningYear);
      repository.update.mockResolvedValue(activeYear);

      const result = await service.transitionStatus(
        'uuid-1',
        AcademicStatus.ACTIVE,
        'school-uuid',
      );

      expect(result.status).toBe(AcademicStatus.ACTIVE);
      expect(repository.update).toHaveBeenCalledWith('uuid-1', {
        status: AcademicStatus.ACTIVE,
      });
    });

    it('should transition from active to completed', async () => {
      const activeYear = { ...mockAcademicYear, status: AcademicStatus.ACTIVE };
      const completedYear = {
        ...mockAcademicYear,
        status: AcademicStatus.COMPLETED,
      };

      repository.findById.mockResolvedValue(activeYear);
      repository.update.mockResolvedValue(completedYear);

      const result = await service.transitionStatus(
        'uuid-1',
        AcademicStatus.COMPLETED,
        'school-uuid',
      );

      expect(result.status).toBe(AcademicStatus.COMPLETED);
      expect(repository.update).toHaveBeenCalledWith('uuid-1', {
        status: AcademicStatus.COMPLETED,
      });
    });

    it('should reject invalid transition from planning to completed', async () => {
      const planningYear = {
        ...mockAcademicYear,
        status: AcademicStatus.PLANNING,
      };
      repository.findById.mockResolvedValue(planningYear);

      await expect(
        service.transitionStatus(
          'uuid-1',
          AcademicStatus.COMPLETED,
          'school-uuid',
        ),
      ).rejects.toThrow(InvalidStatusTransitionException);
    });

    it('should reject invalid transition from completed to planning', async () => {
      const completedYear = {
        ...mockAcademicYear,
        status: AcademicStatus.COMPLETED,
      };
      repository.findById.mockResolvedValue(completedYear);

      await expect(
        service.transitionStatus(
          'uuid-1',
          AcademicStatus.PLANNING,
          'school-uuid',
        ),
      ).rejects.toThrow(InvalidStatusTransitionException);
    });

    it('should reject invalid transition from active to planning', async () => {
      const activeYear = { ...mockAcademicYear, status: AcademicStatus.ACTIVE };
      repository.findById.mockResolvedValue(activeYear);

      await expect(
        service.transitionStatus(
          'uuid-1',
          AcademicStatus.PLANNING,
          'school-uuid',
        ),
      ).rejects.toThrow(InvalidStatusTransitionException);
    });

    it('should reject invalid transition from completed to active', async () => {
      const completedYear = {
        ...mockAcademicYear,
        status: AcademicStatus.COMPLETED,
      };
      repository.findById.mockResolvedValue(completedYear);

      await expect(
        service.transitionStatus(
          'uuid-1',
          AcademicStatus.ACTIVE,
          'school-uuid',
        ),
      ).rejects.toThrow(InvalidStatusTransitionException);
    });

    it('should throw NotFoundException if academic year not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.transitionStatus(
          'nonexistent',
          AcademicStatus.ACTIVE,
          'school-uuid',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if academic year belongs to different school', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);

      await expect(
        service.transitionStatus(
          'uuid-1',
          AcademicStatus.ACTIVE,
          'different-school',
        ),
      ).rejects.toThrow(NotFoundException);
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

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw AcademicYearDateConflictException if updated dates are invalid', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);

      await expect(
        service.update('uuid-1', {
          startDate: '2026-01-01',
          endDate: '2025-01-01',
        }),
      ).rejects.toThrow(AcademicYearDateConflictException);
    });

    it('should throw AcademicYearOverlapException if updated dates overlap with another year', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);
      repository.findOverlapping.mockResolvedValue([
        { ...mockAcademicYear, id: 'uuid-2' },
      ]);

      await expect(
        service.update('uuid-1', {
          startDate: '2025-09-01',
          endDate: '2026-06-30',
        }),
      ).rejects.toThrow(AcademicYearOverlapException);
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

    it('should use transaction when setting isCurrent=true during update', async () => {
      const dto = { isCurrent: true };
      const updatedYear = { ...mockAcademicYear, isCurrent: true };

      repository.findById
        .mockResolvedValueOnce(mockAcademicYear) // findById in update
        .mockResolvedValueOnce(updatedYear); // findById after transaction

      dataSource.transaction.mockImplementation(async (cb: unknown) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({}),
          }),
        };
        return (cb as (manager: typeof mockManager) => Promise<void>)(
          mockManager,
        );
      });

      const result = await service.update('uuid-1', dto);

      expect(result.isCurrent).toBe(true);
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
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

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should verify entity exists before performing soft delete', async () => {
      repository.findById.mockResolvedValue(mockAcademicYear);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('uuid-1');

      // Verify findById was called to check existence first
      expect(repository.findById).toHaveBeenCalledWith('uuid-1');
      expect(repository.findById).toHaveBeenCalledTimes(1);
      expect(repository.softDelete).toHaveBeenCalledTimes(1);
    });
  });
});
