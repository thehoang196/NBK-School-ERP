import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WeekService } from './week.service';
import { WeekRepository } from '../repositories/week.repository';
import { SemesterRepository } from '../repositories/semester.repository';
import { WeekEntity } from '../entities/week.entity';
import { SemesterEntity } from '../entities/semester.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';

describe('WeekService', () => {
  let service: WeekService;
  let weekRepository: jest.Mocked<WeekRepository>;
  let semesterRepository: jest.Mocked<SemesterRepository>;

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
    academicYear: undefined as never,
  };

  const mockWeek: WeekEntity = {
    id: 'week-uuid',
    semesterId: 'semester-uuid',
    weekNumber: 1,
    startDate: '2025-09-01',
    endDate: '2025-09-07',
    note: null,
    isHoliday: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    semester: undefined as never,
  };

  beforeEach(async () => {
    const mockWeekRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySemester: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeekService,
        { provide: WeekRepository, useValue: mockWeekRepository },
        { provide: SemesterRepository, useValue: mockSemesterRepository },
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

      const result = await service.findAll(query);

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

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a week', async () => {
      const dto = {
        semesterId: 'semester-uuid',
        weekNumber: 1,
        startDate: '2025-09-01',
        endDate: '2025-09-07',
      };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.create.mockResolvedValue(mockWeek);

      const result = await service.create(dto);

      expect(result).toEqual(mockWeek);
    });

    it('should throw NotFoundException if semester not found', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          semesterId: 'nonexistent',
          weekNumber: 1,
          startDate: '2025-09-01',
          endDate: '2025-09-07',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateWeeks', () => {
    it('should generate correct number of weeks for a semester', async () => {
      // Semester: 2025-09-01 to 2025-09-21 (3 full weeks)
      const shortSemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01', // Monday
        endDate: '2025-09-21', // Sunday (3 weeks)
      };

      semesterRepository.findById.mockResolvedValue(shortSemester);
      weekRepository.softDeleteBySemester.mockResolvedValue(undefined);
      weekRepository.createMany.mockImplementation(async (data) => {
        return data.map((d, i) => ({
          ...mockWeek,
          id: `week-${i}`,
          weekNumber: d.weekNumber as number,
          startDate: d.startDate as string,
          endDate: d.endDate as string,
        }));
      });

      const result = await service.generateWeeks('semester-uuid');

      expect(result).toHaveLength(3);
      expect(result[0].weekNumber).toBe(1);
      expect(result[0].startDate).toBe('2025-09-01');
      expect(result[0].endDate).toBe('2025-09-07');
      expect(result[1].weekNumber).toBe(2);
      expect(result[1].startDate).toBe('2025-09-08');
      expect(result[1].endDate).toBe('2025-09-14');
      expect(result[2].weekNumber).toBe(3);
      expect(result[2].startDate).toBe('2025-09-15');
      expect(result[2].endDate).toBe('2025-09-21');
    });

    it('should handle partial last week (end date mid-week)', async () => {
      // Semester: 2025-09-01 to 2025-09-10 (1 full week + partial)
      const partialSemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2025-09-10', // Wednesday of second week
      };

      semesterRepository.findById.mockResolvedValue(partialSemester);
      weekRepository.softDeleteBySemester.mockResolvedValue(undefined);
      weekRepository.createMany.mockImplementation(async (data) => {
        return data.map((d, i) => ({
          ...mockWeek,
          id: `week-${i}`,
          weekNumber: d.weekNumber as number,
          startDate: d.startDate as string,
          endDate: d.endDate as string,
        }));
      });

      const result = await service.generateWeeks('semester-uuid');

      expect(result).toHaveLength(2);
      expect(result[0].startDate).toBe('2025-09-01');
      expect(result[0].endDate).toBe('2025-09-07');
      expect(result[1].startDate).toBe('2025-09-08');
      expect(result[1].endDate).toBe('2025-09-10'); // Truncated at semester end
    });

    it('should soft delete existing weeks before generating new ones', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);
      weekRepository.softDeleteBySemester.mockResolvedValue(undefined);
      weekRepository.createMany.mockResolvedValue([]);

      await service.generateWeeks('semester-uuid');

      expect(weekRepository.softDeleteBySemester).toHaveBeenCalledWith('semester-uuid');
    });

    it('should throw NotFoundException if semester not found', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(service.generateWeeks('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should handle single-day semester', async () => {
      const singleDaySemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2025-09-01',
      };

      semesterRepository.findById.mockResolvedValue(singleDaySemester);
      weekRepository.softDeleteBySemester.mockResolvedValue(undefined);
      weekRepository.createMany.mockImplementation(async (data) => {
        return data.map((d, i) => ({
          ...mockWeek,
          id: `week-${i}`,
          weekNumber: d.weekNumber as number,
          startDate: d.startDate as string,
          endDate: d.endDate as string,
        }));
      });

      const result = await service.generateWeeks('semester-uuid');

      expect(result).toHaveLength(1);
      expect(result[0].startDate).toBe('2025-09-01');
      expect(result[0].endDate).toBe('2025-09-01');
    });

    it('should generate weeks for a full real semester (17 weeks)', async () => {
      // Real semester: Sep 1 to Dec 28 = ~17 weeks
      const realSemester: SemesterEntity = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2025-12-28',
      };

      semesterRepository.findById.mockResolvedValue(realSemester);
      weekRepository.softDeleteBySemester.mockResolvedValue(undefined);
      weekRepository.createMany.mockImplementation(async (data) => {
        return data.map((d, i) => ({
          ...mockWeek,
          id: `week-${i}`,
          weekNumber: d.weekNumber as number,
          startDate: d.startDate as string,
          endDate: d.endDate as string,
        }));
      });

      const result = await service.generateWeeks('semester-uuid');

      // Sep 1 to Dec 28 = 119 days = 17 weeks
      expect(result.length).toBe(17);
      expect(result[0].weekNumber).toBe(1);
      expect(result[16].weekNumber).toBe(17);

      // Verify weeks are contiguous (no gaps)
      for (let i = 1; i < result.length; i++) {
        const prevEnd = new Date(result[i - 1].endDate);
        const currStart = new Date(result[i].startDate);
        const diff = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24);
        expect(diff).toBe(1);
      }
    });
  });

  describe('remove', () => {
    it('should soft delete a week', async () => {
      weekRepository.findById.mockResolvedValue(mockWeek);
      weekRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('week-uuid');

      expect(weekRepository.softDelete).toHaveBeenCalledWith('week-uuid');
    });
  });
});
