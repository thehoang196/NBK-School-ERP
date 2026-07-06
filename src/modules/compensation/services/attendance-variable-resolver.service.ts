import { Injectable, Logger } from '@nestjs/common';
import { AttendanceSummaryService } from '../../attendance/services/attendance-summary.service';

/**
 * Resolves attendance-related variables for the Formula Engine.
 * Output variables: NGAY_CONG, CONG_CHUAN, TANG_CA
 */
@Injectable()
export class AttendanceVariableResolverService {
  private readonly logger = new Logger(AttendanceVariableResolverService.name);

  constructor(
    private readonly summaryService: AttendanceSummaryService,
  ) {}

  /**
   * Resolve attendance variables for a teacher in a specific month.
   * Returns a map of variable names → numeric values.
   */
  async resolve(
    teacherId: string,
    schoolId: string,
    month: number,
    year: number,
  ): Promise<Record<string, number>> {
    const summary = await this.summaryService.findByTeacher(
      teacherId,
      schoolId,
      month,
      year,
    );

    if (!summary) {
      this.logger.warn(
        `Không có dữ liệu chấm công cho GV ${teacherId}, tháng ${month}/${year}`,
      );
      return {
        NGAY_CONG: 0,
        CONG_CHUAN: 22,
        TANG_CA: 0,
        NGAY_NGHI_PHEP: 0,
        NGAY_NGHI_KHONG_LUONG: 0,
        NGAY_DI_MUON: 0,
        NGAY_VANG: 0,
      };
    }

    return {
      NGAY_CONG: Number(summary.actualWorkDays),
      CONG_CHUAN: Number(summary.standardWorkDays),
      TANG_CA: Number(summary.totalOvertimeHours),
      NGAY_NGHI_PHEP: Number(summary.paidLeaveDays),
      NGAY_NGHI_KHONG_LUONG: Number(summary.unpaidLeaveDays),
      NGAY_DI_MUON: summary.lateDays,
      NGAY_VANG: summary.absentDays,
    };
  }
}
