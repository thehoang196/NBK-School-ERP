import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WeekService } from './week.service';
import { WeekRepository } from '../repositories/week.repository';
import { SemesterRepository } from '../repositories/semester.repository';
import { WeekEntity } from '../entities/week.entity';
import { SemesterEntity } from '../entities/semester.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';
import { WeekType } from '../enums';
import {
  InvalidDateRangeException,
  WeekOutOfRangeException,
  WeekOverlapException,
  BulkGenerationConflictException,
} from '../exceptions';

describe('WeekService', () => {
  let service: WeekService;
  let weekRepository: jest.Mocked<WeekRepository>;
  let semesterRepository: jest.Mocked<SemesterRepository>;
  let dataSource: { transaction: jest.Mock };

  const mockSemester: SemesterEntity = {
    id: 'semester-uuid',
    academicYearId: 'year-uuid',
    name: 'Học kỳ 1',
    semesterNumber: 1,
    startDate: '2025-09-01',
    endDate: '2025-12-28',
    status: AcademicStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    academicYear: undefined as never,
    weeks: [],
  };

  const mockWeek: WeekEntity = {
    id: 'week-uuid',
    schoolId: 'school-1',
    school: undefined as never,
    semesterId: 'semester-uuid',
    weekNumber: 1,
    startDate: '2025-09-01',
    endDate: '2025-09-07',
    note: null,
    weekType: WeekType.REGULAR,
    isHoliday: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    semester: undefined as never,
  };

  beforeEach(async () => {
    const mockWeekRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySemester: jest.fn(),
      findOverlappingWeeks: jest.fn(),
      getNextWeekNumber: jest.fn(),
      countBySemester: jest.fn(),
      reorderWeeks: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      softDeleteBySemester: jest.fn(),
    };

    const mockSemesterRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByAcademicYear: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeekService,
        { provide: WeekRepository, useValue: mockWeekRepository },
        { provide: SemesterRepository, useValue: mockSemesterRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<WeekService>(WeekService);
    weekRepository = module.get(WeekRepository);
    semesterRepository = module.get(SemesterRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated weeks', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      weekRepository.findAll.mockResolvedValue([[mockWeek], 1]);

      const result = await service.findAll(query, 'school-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return a week by id', async () => {
      weekRepository.findById.mockResolvedValue(mockWeek);

      const result = await service.findById('week-uuid');

      expect(result).toEqual(mockWeek);
    });

    it('should throw NotFoundException if not found', async () => {
      weekRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a week with valid data', async () => {
      const dto = {
        semesterId: 'semester-uuid',
        weekNumber: 1,
        startDate: '2025-09-01',
        endDate: '2025-09-07',
      };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.findOverlappingWeeks.mockResolvedValue([]);
      weekRepository.create.mockResolvedValue(mockWeek);

      const result = await service.create(dto, 'school-1');

      expect(result).toEqual(mockWeek);
    });

    it('should auto-assign weekNumber if not provided', async () => {
      const dto = {
        semesterId: 'semester-uuid',
        startDate: '2025-09-01',
        endDate: '2025-09-07',
      };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.findOverlappingWeeks.mockResolvedValue([]);
      weekRepository.getNextWeekNumber.mockResolvedValue(3);
      weekRepository.create.mockResolvedValue({ ...mockWeek, weekNumber: 3 });

      const result = await service.create(dto, 'school-1');

      expect(weekRepository.getNextWeekNumber).toHaveBeenCalledWith(
        'semester-uuid',
      );
      expect(result.weekNumber).toBe(3);
    });

    it('should throw InvalidDateRangeException if start_date > end_date', async () => {
      const dto = {
        semesterId: 'semester-uuid',
        weekNumber: 1,
        startDate: '2025-09-10',
        endDate: '2025-09-05',
      };

      semesterRepository.findById.mockResolvedValue(mockSemester);

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        InvalidDateRangeException,
      );
    });

    it('should throw WeekOutOfRangeException if dates outside semester range', async () => {
      const dto = {
        semesterId: 'semester-uuid',
        weekNumber: 1,
        startDate: '2025-08-25',
        endDate: '2025-08-31',
      };

      semesterRepository.findById.mockResolvedValue(mockSemester);

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        WeekOutOfRangeException,
      );
    });

    it('should throw WeekOverlapException if date range overlaps existing weeks', async () => {
      const dto = {
        semesterId: 'semester-uuid',
        weekNumber: 2,
        startDate: '2025-09-05',
        endDate: '2025-09-11',
      };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.findOverlappingWeeks.mockResolvedValue([mockWeek]);

      await expect(service.create(dto, 'school-1')).rejects.toThrow(
        WeekOverlapException,
      );
    });

    it('should throw NotFoundException if semester not found', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(
        service.create(
          {
            semesterId: 'nonexistent',
            weekNumber: 1,
            startDate: '2025-09-01',
            endDate: '2025-09-07',
          },
          'school-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkGenerate', () => {
    it('should generate correct number of weeks for a semester', async () => {
      // Semester: 2025-09-01 to 2025-09-21 (3 full weeks, starts on Monday)
      const shortSemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01', // Monday
        endDate: '2025-09-21', // Sunday (3 weeks)
      };

      semesterRepository.findById.mockResolvedValue(shortSemester);
      weekRepository.countBySemester.mockResolvedValue(0);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let savedEntities: Partial<WeekEntity>[] = [];
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const mockRepo = {
            create: (data: Partial<WeekEntity>[]) => {
              savedEntities = data;
              return data.map((d, i) => ({
                ...d,
                id: `week-${i}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                semester: undefined as never,
                note: null,
              }));
            },
            save: (entities: WeekEntity[]) => Promise.resolve(entities),
          };
          const manager = { getRepository: () => mockRepo };
          return cb(manager);
        },
      );

      const result = await service.bulkGenerate('semester-uuid', 'school-1');

      expect(result.count).toBe(3);
      expect(result.weeks[0].weekNumber).toBe(1);
      expect(result.weeks[0].startDate).toBe('2025-09-01');
      expect(result.weeks[0].endDate).toBe('2025-09-07');
      expect(result.weeks[1].weekNumber).toBe(2);
      expect(result.weeks[1].startDate).toBe('2025-09-08');
      expect(result.weeks[1].endDate).toBe('2025-09-14');
      expect(result.weeks[2].weekNumber).toBe(3);
      expect(result.weeks[2].startDate).toBe('2025-09-15');
      expect(result.weeks[2].endDate).toBe('2025-09-21');
    });

    it('should handle partial last week (end date mid-week)', async () => {
      // Semester: 2025-09-01 to 2025-09-10 (1 full week + partial)
      const partialSemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2025-09-10', // Wednesday of second week
      };

      semesterRepository.findById.mockResolvedValue(partialSemester);
      weekRepository.countBySemester.mockResolvedValue(0);

      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const mockRepo = {
            create: (data: Partial<WeekEntity>[]) =>
              data.map((d, i) => ({
                ...d,
                id: `week-${i}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                semester: undefined as never,
                note: null,
              })),
            save: (entities: WeekEntity[]) => Promise.resolve(entities),
          };
          const manager = { getRepository: () => mockRepo };
          return cb(manager);
        },
      );

      const result = await service.bulkGenerate('semester-uuid', 'school-1');

      expect(result.count).toBe(2);
      expect(result.weeks[0].startDate).toBe('2025-09-01');
      expect(result.weeks[0].endDate).toBe('2025-09-07');
      expect(result.weeks[1].startDate).toBe('2025-09-08');
      expect(result.weeks[1].endDate).toBe('2025-09-10'); // Truncated at semester end
    });

    it('should throw BulkGenerationConflictException if weeks already exist', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.countBySemester.mockResolvedValue(5);

      await expect(
        service.bulkGenerate('semester-uuid', 'school-1'),
      ).rejects.toThrow(BulkGenerationConflictException);
    });

    it('should throw NotFoundException if semester not found', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(
        service.bulkGenerate('nonexistent', 'school-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle single-day semester', async () => {
      const singleDaySemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2025-09-01',
      };

      semesterRepository.findById.mockResolvedValue(singleDaySemester);
      weekRepository.countBySemester.mockResolvedValue(0);

      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const mockRepo = {
            create: (data: Partial<WeekEntity>[]) =>
              data.map((d, i) => ({
                ...d,
                id: `week-${i}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                semester: undefined as never,
                note: null,
              })),
            save: (entities: WeekEntity[]) => Promise.resolve(entities),
          };
          const manager = { getRepository: () => mockRepo };
          return cb(manager);
        },
      );

      const result = await service.bulkGenerate('semester-uuid', 'school-1');

      expect(result.count).toBe(1);
      expect(result.weeks[0].startDate).toBe('2025-09-01');
      expect(result.weeks[0].endDate).toBe('2025-09-01');
    });

    it('should use dataSource.transaction for atomic creation', async () => {
      const shortSemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2025-09-07',
      };

      semesterRepository.findById.mockResolvedValue(shortSemester);
      weekRepository.countBySemester.mockResolvedValue(0);

      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const mockRepo = {
            create: (data: Partial<WeekEntity>[]) =>
              data.map((d, i) => ({
                ...d,
                id: `week-${i}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                semester: undefined as never,
                note: null,
              })),
            save: (entities: WeekEntity[]) => Promise.resolve(entities),
          };
          const manager = { getRepository: () => mockRepo };
          return cb(manager);
        },
      );

      await service.bulkGenerate('semester-uuid', 'school-1');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('should set all generated weeks to week_type regular', async () => {
      const shortSemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2025-09-14',
      };

      semesterRepository.findById.mockResolvedValue(shortSemester);
      weekRepository.countBySemester.mockResolvedValue(0);

      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const mockRepo = {
            create: (data: Partial<WeekEntity>[]) =>
              data.map((d, i) => ({
                ...d,
                id: `week-${i}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                semester: undefined as never,
                note: null,
              })),
            save: (entities: WeekEntity[]) => Promise.resolve(entities),
          };
          const manager = { getRepository: () => mockRepo };
          return cb(manager);
        },
      );

      const result = await service.bulkGenerate('semester-uuid', 'school-1');

      result.weeks.forEach((week) => {
        expect(week.weekType).toBe(WeekType.REGULAR);
      });
    });
  });

  describe('reorder', () => {
    it('should reorder weeks atomically in a transaction', async () => {
      const dto = { weekIds: ['week-b', 'week-a', 'week-c'] };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.findBySemester.mockResolvedValue([
        { ...mockWeek, id: 'week-b', weekNumber: 1 },
        { ...mockWeek, id: 'week-a', weekNumber: 2 },
        { ...mockWeek, id: 'week-c', weekNumber: 3 },
      ]);

      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const manager = { update: mockUpdate };
          return cb(manager);
        },
      );

      const result = await service.reorder('semester-uuid', dto, 'school-1');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(WeekEntity, 'week-b', {
        weekNumber: 1,
      });
      expect(mockUpdate).toHaveBeenCalledWith(WeekEntity, 'week-a', {
        weekNumber: 2,
      });
      expect(mockUpdate).toHaveBeenCalledWith(WeekEntity, 'week-c', {
        weekNumber: 3,
      });
      expect(result).toHaveLength(3);
    });

    it('should throw NotFoundException if semester not found', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(
        service.reorder('nonexistent', { weekIds: ['a'] }, 'school-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a week with valid data', async () => {
      const dto = { note: 'Tuần ôn tập' };
      const updatedWeek = { ...mockWeek, note: 'Tuần ôn tập' };

      weekRepository.findById.mockResolvedValue(mockWeek);
      weekRepository.update.mockResolvedValue(updatedWeek);

      const result = await service.update('week-uuid', dto, 'school-1');

      expect(result.note).toBe('Tuần ôn tập');
      expect(weekRepository.update).toHaveBeenCalledWith('week-uuid', {
        note: 'Tuần ôn tập',
      });
    });

    it('should throw NotFoundException if week not found', async () => {
      weekRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { note: 'test' }, 'school-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InvalidDateRangeException if startDate > endDate', async () => {
      const dto = { startDate: '2025-09-10', endDate: '2025-09-05' };

      weekRepository.findById.mockResolvedValue(mockWeek);

      await expect(
        service.update('week-uuid', dto, 'school-1'),
      ).rejects.toThrow(InvalidDateRangeException);
    });

    it('should throw WeekOutOfRangeException if dates outside semester range', async () => {
      const dto = { startDate: '2025-08-01', endDate: '2025-08-07' };

      weekRepository.findById.mockResolvedValue(mockWeek);
      semesterRepository.findById.mockResolvedValue(mockSemester);

      await expect(
        service.update('week-uuid', dto, 'school-1'),
      ).rejects.toThrow(WeekOutOfRangeException);
    });

    it('should throw WeekOverlapException if dates overlap with other weeks', async () => {
      const dto = { startDate: '2025-09-01', endDate: '2025-09-07' };
      const otherWeek = { ...mockWeek, id: 'other-week' };

      weekRepository.findById.mockResolvedValue(mockWeek);
      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.findOverlappingWeeks.mockResolvedValue([otherWeek]);

      await expect(
        service.update('week-uuid', dto, 'school-1'),
      ).rejects.toThrow(WeekOverlapException);
    });

    it('should sync isHoliday when weekType is updated to HOLIDAY', async () => {
      const dto = { weekType: WeekType.HOLIDAY };
      const updatedWeek = {
        ...mockWeek,
        weekType: WeekType.HOLIDAY,
        isHoliday: true,
      };

      weekRepository.findById.mockResolvedValue(mockWeek);
      weekRepository.update.mockResolvedValue(updatedWeek);

      const result = await service.update('week-uuid', dto, 'school-1');

      expect(weekRepository.update).toHaveBeenCalledWith('week-uuid', {
        weekType: WeekType.HOLIDAY,
        isHoliday: true,
      });
      expect(result.isHoliday).toBe(true);
    });

    it('should update weekNumber when provided', async () => {
      const dto = { weekNumber: 5 };
      const updatedWeek = { ...mockWeek, weekNumber: 5 };

      weekRepository.findById.mockResolvedValue(mockWeek);
      weekRepository.update.mockResolvedValue(updatedWeek);

      const result = await service.update('week-uuid', dto, 'school-1');

      expect(result.weekNumber).toBe(5);
    });

    it('should validate dates when only startDate is updated', async () => {
      const dto = { startDate: '2025-09-03' };

      weekRepository.findById.mockResolvedValue(mockWeek);
      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.findOverlappingWeeks.mockResolvedValue([]);
      weekRepository.update.mockResolvedValue({
        ...mockWeek,
        startDate: '2025-09-03',
      });

      const result = await service.update('week-uuid', dto, 'school-1');

      expect(result.startDate).toBe('2025-09-03');
      expect(semesterRepository.findById).toHaveBeenCalledWith('semester-uuid');
    });
  });

  describe('remove', () => {
    it('should soft delete a week', async () => {
      weekRepository.findById.mockResolvedValue(mockWeek);
      weekRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('week-uuid', 'school-1');

      expect(weekRepository.softDelete).toHaveBeenCalledWith('week-uuid');
    });
  });
});
