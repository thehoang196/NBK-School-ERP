import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeachingMetricsService, SubjectActivityMapping } from './teaching-metrics.service';
import { ActualTimetableSlotEntity } from '../../timetable/entities/actual-timetable-slot.entity';
import { TeachingActivityType } from '../enums';

describe('TeachingMetricsService', () => {
  let service: TeachingMetricsService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachingMetricsService,
        {
          provide: getRepositoryToken(ActualTimetableSlotEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TeachingMetricsService>(TeachingMetricsService);
  });

  describe('getTeachingMetrics', () => {
    it('should return metrics grouped by subject and activity type', async () => {
      const subjectId1 = 'subject-toan';
      const subjectId2 = 'subject-ielts';

      mockQueryBuilder.getRawMany.mockResolvedValue([
        { subjectId: subjectId1, count: '15' },
        { subjectId: subjectId2, count: '8' },
      ]);

      const mappings: SubjectActivityMapping[] = [
        { subjectId: subjectId1, activityType: TeachingActivityType.TOAN_VAN_ANH },
        { subjectId: subjectId2, activityType: TeachingActivityType.IELTS },
      ];

      const result = await service.getTeachingMetrics(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        mappings,
      );

      expect(result.teacherId).toBe('teacher-1');
      expect(result.totalHours).toBe(23);
      expect(result.hoursBySubject[subjectId1]).toBe(15);
      expect(result.hoursBySubject[subjectId2]).toBe(8);
      expect(result.hoursByType[TeachingActivityType.TOAN_VAN_ANH]).toBe(15);
      expect(result.hoursByType[TeachingActivityType.IELTS]).toBe(8);
      expect(result.hoursByType[TeachingActivityType.REGULAR]).toBe(0);
    });

    it('should classify unmapped subjects as REGULAR', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { subjectId: 'subject-unknown', count: '10' },
      ]);

      const result = await service.getTeachingMetrics(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        [],
      );

      expect(result.totalHours).toBe(10);
      expect(result.hoursByType[TeachingActivityType.REGULAR]).toBe(10);
    });

    it('should return empty metrics when no slots found', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getTeachingMetrics(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.totalHours).toBe(0);
      expect(result.hoursBySubject).toEqual({});
      expect(result.hoursByType[TeachingActivityType.REGULAR]).toBe(0);
      expect(result.hoursByType[TeachingActivityType.IELTS]).toBe(0);
    });
  });

  describe('getTotalTeachingHours', () => {
    it('should return total count of teaching slots', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: '42' });

      const result = await service.getTotalTeachingHours(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toBe(42);
    });

    it('should return 0 when no result', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      const result = await service.getTotalTeachingHours(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toBe(0);
    });
  });

  describe('getTeachingHoursBySubject', () => {
    it('should return count filtered by subject', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: '12' });

      const result = await service.getTeachingHoursBySubject(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        'subject-math',
      );

      expect(result).toBe(12);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'slot.subject_id = :subjectId',
        { subjectId: 'subject-math' },
      );
    });

    it('should return 0 when no result', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      const result = await service.getTeachingHoursBySubject(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        'non-existent',
      );

      expect(result).toBe(0);
    });
  });

  describe('getTeachingHoursByType', () => {
    it('should return count for specific activity type', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: '7' });

      const mappings: SubjectActivityMapping[] = [
        { subjectId: 'subject-ielts-1', activityType: TeachingActivityType.IELTS },
        { subjectId: 'subject-ielts-2', activityType: TeachingActivityType.IELTS },
      ];

      const result = await service.getTeachingHoursByType(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        TeachingActivityType.IELTS,
        mappings,
      );

      expect(result).toBe(7);
    });

    it('should return 0 when activity type has no mapping', async () => {
      const result = await service.getTeachingHoursByType(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        TeachingActivityType.TAM_LY,
        [],
      );

      expect(result).toBe(0);
    });

    it('should count all non-mapped subjects for REGULAR type', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: '20' });

      const mappings: SubjectActivityMapping[] = [
        { subjectId: 'subject-ielts', activityType: TeachingActivityType.IELTS },
      ];

      const result = await service.getTeachingHoursByType(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        TeachingActivityType.REGULAR,
        mappings,
      );

      expect(result).toBe(20);
    });
  });
});
