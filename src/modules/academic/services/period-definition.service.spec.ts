import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PeriodDefinitionService } from './period-definition.service';
import { PeriodDefinitionRepository } from '../repositories/period-definition.repository';
import {
  PeriodOverlapException,
  InvalidDateRangeException,
} from '../exceptions';
import { GradeLevel } from '../enums';
import { PeriodDefinitionEntity } from '../entities/period-definition.entity';

describe('PeriodDefinitionService', () => {
  let service: PeriodDefinitionService;
  let repository: jest.Mocked<PeriodDefinitionRepository>;

  const mockPeriod = (
    overrides: Partial<PeriodDefinitionEntity> = {},
  ): PeriodDefinitionEntity =>
    ({
      id: 'period-1',
      schoolId: 'school-1',
      sessionId: 'session-1',
      gradeLevel: GradeLevel.PRIMARY,
      periodNumber: 1,
      startTime: '07:00',
      endTime: '07:45',
      isBreak: false,
      isExtra: false,
      deletedAt: null,
      ...overrides,
    }) as PeriodDefinitionEntity;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySession: jest.fn(),
      findBySessionAndGradeLevel: jest.fn(),
      findBySchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<PeriodDefinitionRepository>;

    service = new PeriodDefinitionService(repository);
  });

  describe('create', () => {
    it('should create a period definition successfully', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 1,
        startTime: '07:00',
        endTime: '07:45',
      };

      repository.findBySessionAndGradeLevel.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockPeriod());

      const result = await service.create(dto, 'school-1');

      expect(result).toEqual(mockPeriod());
      expect(repository.findBySessionAndGradeLevel).toHaveBeenCalledWith(
        'session-1',
        GradeLevel.PRIMARY,
      );
      expect(repository.create).toHaveBeenCalled();
    });

    it('should throw InvalidDateRangeException when startTime >= endTime', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 1,
        startTime: '08:00',
        endTime: '07:00',
      };

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        InvalidDateRangeException,
      );
    });

    it('should throw BadRequestException when periodNumber is 0', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 0,
        startTime: '07:00',
        endTime: '07:45',
      };

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when periodNumber is negative', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: -1,
        startTime: '07:00',
        endTime: '07:45',
      };

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InvalidDateRangeException when startTime equals endTime', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 1,
        startTime: '07:00',
        endTime: '07:00',
      };

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        InvalidDateRangeException,
      );
    });

    it('should throw PeriodOverlapException when time overlaps with existing non-break period', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 2,
        startTime: '07:30',
        endTime: '08:15',
      };

      repository.findBySessionAndGradeLevel.mockResolvedValue([
        mockPeriod({ id: 'existing-1', startTime: '07:00', endTime: '07:45' }),
      ]);

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        PeriodOverlapException,
      );
    });

    it('should allow break periods to overlap with existing periods', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 2,
        startTime: '07:40',
        endTime: '07:50',
        isBreak: true,
      };

      repository.findBySessionAndGradeLevel.mockResolvedValue([
        mockPeriod({ id: 'existing-1', startTime: '07:00', endTime: '07:45' }),
      ]);
      repository.create.mockResolvedValue(
        mockPeriod({ ...dto, id: 'new-break' }),
      );

      const result = await service.create(dto, 'school-1');

      // Overlap check is NOT called for break periods
      expect(repository.findBySessionAndGradeLevel).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should skip existing break periods during overlap check', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 2,
        startTime: '07:45',
        endTime: '08:30',
      };

      repository.findBySessionAndGradeLevel.mockResolvedValue([
        mockPeriod({
          id: 'break-1',
          startTime: '07:40',
          endTime: '07:50',
          isBreak: true,
        }),
      ]);
      repository.create.mockResolvedValue(
        mockPeriod({ ...dto, id: 'new-period' }),
      );

      const result = await service.create(dto, 'school-1');

      expect(result).toBeDefined();
    });

    it('should allow non-overlapping periods for same session and grade level', async () => {
      const dto = {
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
        periodNumber: 2,
        startTime: '07:45',
        endTime: '08:30',
      };

      repository.findBySessionAndGradeLevel.mockResolvedValue([
        mockPeriod({ id: 'existing-1', startTime: '07:00', endTime: '07:45' }),
      ]);
      repository.create.mockResolvedValue(
        mockPeriod({ ...dto, id: 'new-period' }),
      );

      const result = await service.create(dto, 'school-1');

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a period definition successfully', async () => {
      const existingPeriod = mockPeriod();
      const dto = { startTime: '07:15', endTime: '08:00' };

      repository.findById.mockResolvedValue(existingPeriod);
      repository.findBySessionAndGradeLevel.mockResolvedValue([existingPeriod]);
      repository.update.mockResolvedValue(mockPeriod({ ...dto }));

      const result = await service.update('period-1', dto);

      expect(result.startTime).toBe('07:15');
    });

    it('should throw InvalidDateRangeException when updated startTime >= endTime', async () => {
      const existingPeriod = mockPeriod({
        startTime: '07:00',
        endTime: '07:45',
      });
      repository.findById.mockResolvedValue(existingPeriod);

      await expect(
        service.update('period-1', { startTime: '08:00' }),
      ).rejects.toThrow(InvalidDateRangeException);
    });

    it('should throw InvalidDateRangeException when updated endTime <= startTime', async () => {
      const existingPeriod = mockPeriod({
        startTime: '07:00',
        endTime: '07:45',
      });
      repository.findById.mockResolvedValue(existingPeriod);

      await expect(
        service.update('period-1', { endTime: '06:30' }),
      ).rejects.toThrow(InvalidDateRangeException);
    });

    it('should throw PeriodOverlapException when updated time overlaps another period', async () => {
      const existingPeriod = mockPeriod({
        id: 'period-1',
        startTime: '07:00',
        endTime: '07:45',
      });
      const otherPeriod = mockPeriod({
        id: 'period-2',
        startTime: '07:45',
        endTime: '08:30',
      });

      repository.findById.mockResolvedValue(existingPeriod);
      repository.findBySessionAndGradeLevel.mockResolvedValue([
        existingPeriod,
        otherPeriod,
      ]);

      await expect(
        service.update('period-1', { endTime: '08:00' }),
      ).rejects.toThrow(PeriodOverlapException);
    });

    it('should exclude self from overlap check during update', async () => {
      const existingPeriod = mockPeriod({
        id: 'period-1',
        startTime: '07:00',
        endTime: '07:45',
      });

      repository.findById.mockResolvedValue(existingPeriod);
      repository.findBySessionAndGradeLevel.mockResolvedValue([existingPeriod]);
      repository.update.mockResolvedValue(
        mockPeriod({ startTime: '07:00', endTime: '07:50' }),
      );

      // Should not throw because it excludes itself from overlap check
      const result = await service.update('period-1', { endTime: '07:50' });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when period does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { startTime: '07:00' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updated periodNumber is 0', async () => {
      const existingPeriod = mockPeriod();
      repository.findById.mockResolvedValue(existingPeriod);

      await expect(
        service.update('period-1', { periodNumber: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when updated periodNumber is negative', async () => {
      const existingPeriod = mockPeriod();
      repository.findById.mockResolvedValue(existingPeriod);

      await expect(
        service.update('period-1', { periodNumber: -5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should support filtering by sessionId and gradeLevel', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC' as const,
        sessionId: 'session-1',
        gradeLevel: GradeLevel.PRIMARY,
      };

      repository.findAll.mockResolvedValue([[mockPeriod()], 1]);

      const result = await service.findAll(query, 'school-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(repository.findAll).toHaveBeenCalledWith(query, 'school-1');
    });

    it('should support filtering by sessionId only', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC' as const,
        sessionId: 'session-1',
      };

      repository.findAll.mockResolvedValue([[mockPeriod()], 1]);

      const result = await service.findAll(query, 'school-1');

      expect(result.success).toBe(true);
      expect(repository.findAll).toHaveBeenCalledWith(query, 'school-1');
    });

    it('should support filtering by gradeLevel only', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC' as const,
        gradeLevel: GradeLevel.MIDDLE_SCHOOL,
      };

      repository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll(query, 'school-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(repository.findAll).toHaveBeenCalledWith(query, 'school-1');
    });
  });

  describe('findBySession', () => {
    it('should return all period definitions for a given sessionId', async () => {
      const periods = [
        mockPeriod({ id: 'period-1', periodNumber: 1 }),
        mockPeriod({
          id: 'period-2',
          periodNumber: 2,
          startTime: '07:45',
          endTime: '08:30',
        }),
      ];

      repository.findBySession.mockResolvedValue(periods);

      const result = await service.findBySession('session-1');

      expect(result).toEqual(periods);
      expect(repository.findBySession).toHaveBeenCalledWith('session-1');
    });

    it('should return empty array when no periods exist for session', async () => {
      repository.findBySession.mockResolvedValue([]);

      const result = await service.findBySession('nonexistent-session');

      expect(result).toEqual([]);
      expect(repository.findBySession).toHaveBeenCalledWith(
        'nonexistent-session',
      );
    });
  });

  describe('findById', () => {
    it('should return a period definition by id', async () => {
      const period = mockPeriod();
      repository.findById.mockResolvedValue(period);

      const result = await service.findById('period-1', 'school-1');

      expect(result).toEqual(period);
      expect(repository.findById).toHaveBeenCalledWith('period-1', 'school-1');
    });

    it('should throw NotFoundException when period not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent', 'school-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete a period definition', async () => {
      repository.findById.mockResolvedValue(mockPeriod());
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('period-1');

      expect(repository.softDelete).toHaveBeenCalledWith('period-1');
    });

    it('should throw NotFoundException when period does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
