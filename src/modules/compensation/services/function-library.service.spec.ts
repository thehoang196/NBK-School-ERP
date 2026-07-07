import { Test, TestingModule } from '@nestjs/testing';
import { FunctionLibraryService } from './function-library.service';
import { TeachingMetricsService } from './teaching-metrics.service';
import { AttendanceSummaryService } from '../../attendance/services/attendance-summary.service';
import { TeachingActivityType } from '../enums';

describe('FunctionLibraryService', () => {
  let service: FunctionLibraryService;
  let teachingMetricsService: jest.Mocked<TeachingMetricsService>;
  let attendanceSummaryService: jest.Mocked<AttendanceSummaryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FunctionLibraryService,
        {
          provide: TeachingMetricsService,
          useValue: {
            getTotalTeachingHours: jest.fn(),
            getTeachingHoursBySubject: jest.fn(),
            getTeachingHoursByType: jest.fn(),
          },
        },
        {
          provide: AttendanceSummaryService,
          useValue: {
            findByTeacher: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FunctionLibraryService>(FunctionLibraryService);
    teachingMetricsService = module.get(TeachingMetricsService);
    attendanceSummaryService = module.get(AttendanceSummaryService);
  });

  describe('getAllFunctions', () => {
    it('should return all functions including TeachingHoursByType', () => {
      const functions = service.getAllFunctions();
      const names = functions.map((f) => f.name);

      expect(names).toContain('TeachingHours');
      expect(names).toContain('TeachingHoursBySubject');
      expect(names).toContain('TeachingHoursByType');
      expect(names).toContain('AttendanceDays');
      expect(names).toContain('SUM');
      expect(names).toContain('IF');
    });

    it('should categorize business functions correctly', () => {
      const functions = service.getAllFunctions();
      const businessFns = functions.filter((f) => f.category === 'business');

      expect(businessFns.length).toBeGreaterThanOrEqual(4);
      expect(businessFns.map((f) => f.name)).toContain('TeachingHoursByType');
    });
  });

  describe('getFunction', () => {
    it('should return function documentation', () => {
      const fn = service.getFunction('TeachingHoursByType');

      expect(fn).not.toBeNull();
      expect(fn!.name).toBe('TeachingHoursByType');
      expect(fn!.params).toHaveLength(3);
      expect(fn!.category).toBe('business');
    });

    it('should return null for unknown function', () => {
      const fn = service.getFunction('NonExistent');
      expect(fn).toBeNull();
    });
  });

  describe('getTeachingHours', () => {
    it('should delegate to TeachingMetricsService.getTotalTeachingHours', async () => {
      teachingMetricsService.getTotalTeachingHours.mockResolvedValue(35);

      const result = await service.getTeachingHours(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toBe(35);
      expect(teachingMetricsService.getTotalTeachingHours).toHaveBeenCalledWith(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
      );
    });
  });

  describe('getTeachingHoursBySubject', () => {
    it('should delegate to TeachingMetricsService.getTeachingHoursBySubject', async () => {
      teachingMetricsService.getTeachingHoursBySubject.mockResolvedValue(12);

      const result = await service.getTeachingHoursBySubject(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        'subject-math',
      );

      expect(result).toBe(12);
    });
  });

  describe('getTeachingHoursByType', () => {
    it('should delegate to TeachingMetricsService.getTeachingHoursByType', async () => {
      teachingMetricsService.getTeachingHoursByType.mockResolvedValue(8);

      const result = await service.getTeachingHoursByType(
        'teacher-1',
        'school-1',
        '2026-01-01',
        '2026-01-31',
        TeachingActivityType.IELTS,
        [{ subjectId: 'sub-1', activityType: TeachingActivityType.IELTS }],
      );

      expect(result).toBe(8);
    });
  });

  describe('getAttendanceDays', () => {
    it('should return actual work days from attendance summary', async () => {
      attendanceSummaryService.findByTeacher.mockResolvedValue({
        actualWorkDays: 22,
        standardWorkDays: 26,
        totalOvertimeHours: 5,
      } as any);

      const result = await service.getAttendanceDays(
        'teacher-1',
        'school-1',
        '2026-06-01',
        '2026-06-30',
      );

      expect(result).toBe(22);
      expect(attendanceSummaryService.findByTeacher).toHaveBeenCalledWith(
        'teacher-1',
        'school-1',
        6,
        2026,
      );
    });

    it('should return 0 when no attendance summary found', async () => {
      attendanceSummaryService.findByTeacher.mockResolvedValue(null);

      const result = await service.getAttendanceDays(
        'teacher-1',
        'school-1',
        '2026-06-01',
        '2026-06-30',
      );

      expect(result).toBe(0);
    });
  });
});
