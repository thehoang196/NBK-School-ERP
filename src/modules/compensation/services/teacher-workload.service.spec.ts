import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeacherWorkloadService } from './teacher-workload.service';
import { TeacherWorkloadEntity } from '../entities/teacher-workload.entity';
import { TeachingMetricsService } from './teaching-metrics.service';
import { PayPeriodService } from './pay-period.service';
import { TeachingActivityType } from '../enums';

describe('TeacherWorkloadService', () => {
  let service: TeacherWorkloadService;
  let teachingMetrics: jest.Mocked<TeachingMetricsService>;
  let payPeriodService: jest.Mocked<PayPeriodService>;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherWorkloadService,
        {
          provide: getRepositoryToken(TeacherWorkloadEntity),
          useValue: mockRepo,
        },
        {
          provide: TeachingMetricsService,
          useValue: { getTeachingMetrics: jest.fn() },
        },
        {
          provide: PayPeriodService,
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherWorkloadService>(TeacherWorkloadService);
    teachingMetrics = module.get(TeachingMetricsService);
    payPeriodService = module.get(PayPeriodService);

    jest.clearAllMocks();
  });

  describe('calculateWorkload', () => {
    it('should create new workload record when none exists', async () => {
      payPeriodService.findById.mockResolvedValue({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      } as any);

      teachingMetrics.getTeachingMetrics.mockResolvedValue({
        teacherId: 'teacher-1',
        totalHours: 35,
        hoursByType: { [TeachingActivityType.REGULAR]: 20, [TeachingActivityType.IELTS]: 15 },
        hoursBySubject: { 'sub-1': 20, 'sub-2': 15 },
      } as any);

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ id: 'new-1' });
      mockRepo.save.mockResolvedValue({
        id: 'new-1',
        totalHours: 35,
        hoursByType: { regular: 20, ielts: 15 },
      });

      const result = await service.calculateWorkload('teacher-1', 'period-1', 'school-1');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalHours: 35 }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should update existing workload record', async () => {
      payPeriodService.findById.mockResolvedValue({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      } as any);

      teachingMetrics.getTeachingMetrics.mockResolvedValue({
        teacherId: 'teacher-1',
        totalHours: 40,
        hoursByType: { [TeachingActivityType.REGULAR]: 40 },
        hoursBySubject: { 'sub-1': 40 },
      } as any);

      const existing = { id: 'existing-1', totalHours: 30 };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockResolvedValue({ ...existing, totalHours: 40 });

      const result = await service.calculateWorkload('teacher-1', 'period-1', 'school-1');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalHours: 40 }),
      );
    });
  });

  describe('getWorkload', () => {
    it('should return null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getWorkload('teacher-1', 'period-1', 'school-1');
      expect(result).toBeNull();
    });
  });

  describe('regenerateWorkload', () => {
    it('should process all teachers and return counts', async () => {
      payPeriodService.findById.mockResolvedValue({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      } as any);

      teachingMetrics.getTeachingMetrics.mockResolvedValue({
        teacherId: 'any',
        totalHours: 20,
        hoursByType: {},
        hoursBySubject: {},
      } as any);

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({});

      const result = await service.regenerateWorkload(
        'period-1',
        'school-1',
        ['t-1', 't-2', 't-3'],
      );

      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
    });
  });
});
