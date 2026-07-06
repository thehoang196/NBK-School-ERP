import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttendanceSummaryService } from './attendance-summary.service';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceSummaryRepository } from '../repositories/attendance-summary.repository';
import { AttendanceStatus } from '../enums';

describe('AttendanceSummaryService', () => {
  let service: AttendanceSummaryService;
  let recordRepo: jest.Mocked<AttendanceRecordRepository>;
  let summaryRepo: jest.Mocked<AttendanceSummaryRepository>;

  const mockSchoolId = 'school-001';
  const mockTeacherId = 'teacher-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceSummaryService,
        {
          provide: AttendanceRecordRepository,
          useValue: {
            findByTeacherAndDateRange: jest.fn(),
            findBySchoolAndDateRange: jest.fn(),
          },
        },
        {
          provide: AttendanceSummaryRepository,
          useValue: {
            findAll: jest.fn(),
            findByTeacher: jest.fn(),
            upsert: jest.fn(),
            finalize: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AttendanceSummaryService);
    recordRepo = module.get(AttendanceRecordRepository);
    summaryRepo = module.get(AttendanceSummaryRepository);
  });

  describe('calculateSummary', () => {
    it('should calculate summary from attendance records', async () => {
      const records = [
        { status: AttendanceStatus.PRESENT, workCoefficient: 1, overtimeHours: 2, leaveType: null },
        { status: AttendanceStatus.PRESENT, workCoefficient: 1, overtimeHours: 0, leaveType: null },
        { status: AttendanceStatus.LATE, workCoefficient: 1, overtimeHours: 0, leaveType: null },
        { status: AttendanceStatus.HALF_DAY, workCoefficient: 0.5, overtimeHours: 0, leaveType: null },
        { status: AttendanceStatus.LEAVE, workCoefficient: 0, overtimeHours: 0, leaveType: 'annual' },
        { status: AttendanceStatus.ABSENT, workCoefficient: 0, overtimeHours: 0, leaveType: 'unpaid' },
      ];

      recordRepo.findByTeacherAndDateRange.mockResolvedValue(records as any);
      summaryRepo.upsert.mockImplementation(async (data) => data as any);

      const result = await service.calculateSummary(mockTeacherId, mockSchoolId, 7, 2026);

      expect(result.actualWorkDays).toBe(3.5); // 1+1+1+0.5+0+0
      expect(result.totalOvertimeHours).toBe(2);
      expect(result.lateDays).toBe(1);
      expect(result.paidLeaveDays).toBe(1);
      expect(result.unpaidLeaveDays).toBe(1);
      expect(result.absentDays).toBe(1);
    });

    it('should use provided standardWorkDays if given', async () => {
      recordRepo.findByTeacherAndDateRange.mockResolvedValue([]);
      summaryRepo.upsert.mockImplementation(async (data) => data as any);

      const result = await service.calculateSummary(mockTeacherId, mockSchoolId, 7, 2026, 26);

      expect(result.standardWorkDays).toBe(26);
    });
  });

  describe('calculateAllSummaries', () => {
    it('should calculate summaries for all teachers with records', async () => {
      const records = [
        { teacherId: 'teacher-001', status: AttendanceStatus.PRESENT, workCoefficient: 1, overtimeHours: 0, leaveType: null },
        { teacherId: 'teacher-001', status: AttendanceStatus.PRESENT, workCoefficient: 1, overtimeHours: 1, leaveType: null },
        { teacherId: 'teacher-002', status: AttendanceStatus.PRESENT, workCoefficient: 1, overtimeHours: 0, leaveType: null },
      ];

      recordRepo.findBySchoolAndDateRange.mockResolvedValue(records as any);
      summaryRepo.upsert.mockImplementation(async (data) => data as any);

      const result = await service.calculateAllSummaries(mockSchoolId, 7, 2026);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('finalize', () => {
    it('should finalize all summaries for the month', async () => {
      const summaries = [
        { id: 's-1', isFinalized: false },
        { id: 's-2', isFinalized: false },
      ];
      summaryRepo.findAll.mockResolvedValue([summaries as any, summaries.length]);
      summaryRepo.finalize.mockResolvedValue(undefined);

      await service.finalize(mockSchoolId, 7, 2026);

      expect(summaryRepo.finalize).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when no summaries exist', async () => {
      summaryRepo.findAll.mockResolvedValue([[], 0]);

      await expect(service.finalize(mockSchoolId, 7, 2026)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
