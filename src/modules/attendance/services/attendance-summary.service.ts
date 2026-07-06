import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceSummaryRepository } from '../repositories/attendance-summary.repository';
import { AttendanceSummaryEntity } from '../entities/attendance-summary.entity';
import { AttendanceSummaryQueryDto } from '../dto/attendance-summary-query.dto';
import { AttendanceStatus } from '../enums';

export interface SummaryCalculationResult {
  teacherId: string;
  actualWorkDays: number;
  standardWorkDays: number;
  totalOvertimeHours: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateDays: number;
  absentDays: number;
}

@Injectable()
export class AttendanceSummaryService {
  private readonly logger = new Logger(AttendanceSummaryService.name);

  constructor(
    private readonly recordRepository: AttendanceRecordRepository,
    private readonly summaryRepository: AttendanceSummaryRepository,
  ) {}

  async findAll(
    schoolId: string,
    query: AttendanceSummaryQueryDto,
  ): Promise<{ items: AttendanceSummaryEntity[]; total: number }> {
    const [items, total] = await this.summaryRepository.findAll(
      schoolId,
      query,
    );
    return { items, total };
  }

  async findByTeacher(
    teacherId: string,
    schoolId: string,
    month: number,
    year: number,
  ): Promise<AttendanceSummaryEntity | null> {
    return this.summaryRepository.findByTeacher(
      teacherId,
      schoolId,
      month,
      year,
    );
  }

  /**
   * Tính tổng hợp chấm công cho 1 giáo viên trong tháng.
   * Tính từ attendance_records.
   */
  async calculateSummary(
    teacherId: string,
    schoolId: string,
    month: number,
    year: number,
    standardWorkDays?: number,
  ): Promise<AttendanceSummaryEntity> {
    // Get date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.recordRepository.findByTeacherAndDateRange(
      teacherId,
      startDate,
      endDate,
      schoolId,
    );

    const result = this.aggregateRecords(records, teacherId);

    return this.summaryRepository.upsert({
      schoolId,
      teacherId,
      month,
      year,
      actualWorkDays: result.actualWorkDays,
      standardWorkDays: standardWorkDays ?? result.standardWorkDays,
      totalOvertimeHours: result.totalOvertimeHours,
      paidLeaveDays: result.paidLeaveDays,
      unpaidLeaveDays: result.unpaidLeaveDays,
      lateDays: result.lateDays,
      absentDays: result.absentDays,
      isFinalized: false,
    });
  }

  /**
   * Tính tổng hợp chấm công cho TẤT CẢ giáo viên trong trường, theo tháng.
   * Dùng cho batch processing trước khi tính lương.
   */
  async calculateAllSummaries(
    schoolId: string,
    month: number,
    year: number,
    standardWorkDays?: number,
  ): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.recordRepository.findBySchoolAndDateRange(
      schoolId,
      startDate,
      endDate,
    );

    // Group records by teacher
    const byTeacher = new Map<string, typeof records>();
    for (const record of records) {
      const existing = byTeacher.get(record.teacherId) || [];
      existing.push(record);
      byTeacher.set(record.teacherId, existing);
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const [teacherId, teacherRecords] of byTeacher) {
      try {
        const result = this.aggregateRecords(teacherRecords, teacherId);

        await this.summaryRepository.upsert({
          schoolId,
          teacherId,
          month,
          year,
          actualWorkDays: result.actualWorkDays,
          standardWorkDays: standardWorkDays ?? result.standardWorkDays,
          totalOvertimeHours: result.totalOvertimeHours,
          paidLeaveDays: result.paidLeaveDays,
          unpaidLeaveDays: result.unpaidLeaveDays,
          lateDays: result.lateDays,
          absentDays: result.absentDays,
          isFinalized: false,
        });

        successCount++;
      } catch (error) {
        errors.push(
          `GV ${teacherId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Tổng hợp chấm công tháng ${month}/${year}: ${successCount} GV thành công, ${errors.length} lỗi`,
    );

    return { successCount, errorCount: errors.length, errors };
  }

  /**
   * Chốt công tháng — sau khi chốt không cho sửa.
   */
  async finalize(
    schoolId: string,
    month: number,
    year: number,
  ): Promise<void> {
    const [summaries] = await this.summaryRepository.findAll(schoolId, {
      month,
      year,
      page: 1,
      limit: 10000,
      sortOrder: 'ASC',
    });

    if (summaries.length === 0) {
      throw new BadRequestException(
        `Chưa có dữ liệu tổng hợp chấm công tháng ${month}/${year}. Vui lòng tính tổng hợp trước.`,
      );
    }

    for (const summary of summaries) {
      if (!summary.isFinalized) {
        await this.summaryRepository.finalize(summary.id);
      }
    }

    this.logger.log(
      `Chốt công tháng ${month}/${year}: ${summaries.length} bản ghi`,
    );
  }

  /**
   * Aggregate attendance records into summary metrics.
   */
  private aggregateRecords(
    records: { status: AttendanceStatus; workCoefficient: number; overtimeHours: number; leaveType: string | null }[],
    teacherId: string,
  ): SummaryCalculationResult {
    let actualWorkDays = 0;
    let totalOvertimeHours = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let lateDays = 0;
    let absentDays = 0;

    for (const record of records) {
      actualWorkDays += Number(record.workCoefficient);
      totalOvertimeHours += Number(record.overtimeHours);

      switch (record.status) {
        case AttendanceStatus.LATE:
          lateDays++;
          break;
        case AttendanceStatus.ABSENT:
          absentDays++;
          if (record.leaveType === 'unpaid') {
            unpaidLeaveDays++;
          }
          break;
        case AttendanceStatus.LEAVE:
          if (record.leaveType === 'unpaid') {
            unpaidLeaveDays++;
          } else {
            paidLeaveDays++;
          }
          break;
        case AttendanceStatus.HALF_DAY:
          // Half day counted via workCoefficient
          break;
      }
    }

    // Default standard work days = 22 (common in Vietnam)
    const standardWorkDays = 22;

    return {
      teacherId,
      actualWorkDays: Math.round(actualWorkDays * 100) / 100,
      standardWorkDays,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      paidLeaveDays: Math.round(paidLeaveDays * 100) / 100,
      unpaidLeaveDays: Math.round(unpaidLeaveDays * 100) / 100,
      lateDays,
      absentDays,
    };
  }
}
