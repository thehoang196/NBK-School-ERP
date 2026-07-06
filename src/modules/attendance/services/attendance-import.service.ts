import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { AttendanceRecordEntity } from '../entities/attendance-record.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { AttendanceStatus, AttendanceMethod, LeaveType } from '../enums';

export interface AttendanceImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: AttendanceImportError[];
}

export interface AttendanceImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

/**
 * Service import chấm công từ Excel.
 * Template chuẩn: Mã NV | Ngày | Giờ vào | Giờ ra | Trạng thái | Tăng ca | Ghi chú
 */
@Injectable()
export class AttendanceImportService {
  private readonly logger = new Logger(AttendanceImportService.name);

  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly recordRepo: Repository<AttendanceRecordEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async importFromExcel(
    buffer: Buffer,
    schoolId: string,
    userId: string,
  ): Promise<AttendanceImportResult> {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    // Parse rows
    const rows = this.parseWorksheet(worksheet);
    const errors: AttendanceImportError[] = [];
    const validRecords: Partial<AttendanceRecordEntity>[] = [];

    // Pre-fetch teachers for lookup
    const teachers = await this.teacherRepo.find({
      where: { schoolId, deletedAt: IsNull() },
      select: ['id', 'employeeCode'],
    });
    const teacherMap = new Map(teachers.map((t) => [t.employeeCode, t.id]));

    for (const row of rows) {
      const validated = this.validateRow(row, teacherMap, errors);
      if (validated) {
        validRecords.push({
          ...validated,
          schoolId,
          createdBy: userId,
        });
      }
    }

    if (validRecords.length === 0) {
      return {
        totalRows: rows.length,
        successCount: 0,
        errorCount: errors.length,
        errors,
      };
    }

    // Insert within transaction — upsert logic (replace existing for same teacher+date)
    let successCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const record of validRecords) {
        // Check if record already exists for this teacher+date
        const existing = await manager.findOne(AttendanceRecordEntity, {
          where: {
            teacherId: record.teacherId!,
            workDate: record.workDate!,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          // Upsert: update existing
          await manager.update(AttendanceRecordEntity, existing.id, {
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            status: record.status,
            overtimeHours: record.overtimeHours,
            workCoefficient: record.workCoefficient,
            note: record.note,
            method: AttendanceMethod.MANUAL,
            updatedBy: userId,
          });
        } else {
          const entity = manager.create(AttendanceRecordEntity, record);
          await manager.save(entity);
        }
        successCount++;
      }
    });

    this.logger.log(
      `Import chấm công: ${successCount} thành công, ${errors.length} lỗi`,
    );

    return {
      totalRows: rows.length,
      successCount,
      errorCount: errors.length,
      errors,
    };
  }

  private parseWorksheet(
    worksheet: import('exceljs').Worksheet,
  ): ParsedAttendanceRow[] {
    const results: ParsedAttendanceRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const employeeCode = String(row.getCell(1).value || '').trim();
      const workDate = String(row.getCell(2).value || '').trim();
      const checkIn = String(row.getCell(3).value || '').trim() || null;
      const checkOut = String(row.getCell(4).value || '').trim() || null;
      const statusRaw = String(row.getCell(5).value || '').trim();
      const overtimeRaw = String(row.getCell(6).value || '').trim();
      const note = String(row.getCell(7).value || '').trim() || null;

      results.push({
        rowNumber,
        employeeCode,
        workDate,
        checkIn,
        checkOut,
        statusRaw,
        overtimeRaw,
        note,
      });
    });

    return results;
  }

  private validateRow(
    row: ParsedAttendanceRow,
    teacherMap: Map<string, string>,
    errors: AttendanceImportError[],
  ): Partial<AttendanceRecordEntity> | null {
    // Validate employee code
    if (!row.employeeCode) {
      errors.push({
        row: row.rowNumber,
        field: 'employeeCode',
        message: 'Mã NV là bắt buộc',
      });
      return null;
    }

    const teacherId = teacherMap.get(row.employeeCode);
    if (!teacherId) {
      errors.push({
        row: row.rowNumber,
        field: 'employeeCode',
        message: `Không tìm thấy giáo viên với mã "${row.employeeCode}"`,
        value: row.employeeCode,
      });
      return null;
    }

    // Validate work date
    const workDate = this.parseDate(row.workDate);
    if (!workDate) {
      errors.push({
        row: row.rowNumber,
        field: 'workDate',
        message: `Ngày "${row.workDate}" không hợp lệ. Định dạng: YYYY-MM-DD hoặc DD/MM/YYYY`,
        value: row.workDate,
      });
      return null;
    }

    // Parse status
    const status = this.parseStatus(row.statusRaw);
    if (!status) {
      errors.push({
        row: row.rowNumber,
        field: 'status',
        message: `Trạng thái "${row.statusRaw}" không hợp lệ. Chấp nhận: Đi làm, Muộn, Vắng, Nghỉ phép, Nửa ngày`,
        value: row.statusRaw,
      });
      return null;
    }

    // Parse overtime
    let overtimeHours = 0;
    if (row.overtimeRaw) {
      overtimeHours = parseFloat(row.overtimeRaw);
      if (isNaN(overtimeHours) || overtimeHours < 0) {
        errors.push({
          row: row.rowNumber,
          field: 'overtimeHours',
          message: `Tăng ca "${row.overtimeRaw}" phải là số không âm`,
          value: row.overtimeRaw,
        });
        return null;
      }
    }

    // Calculate work coefficient from status
    const workCoefficient = this.getCoefficient(status);

    return {
      teacherId,
      workDate,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status,
      method: AttendanceMethod.MANUAL,
      overtimeHours,
      workCoefficient,
      note: row.note,
    };
  }

  private parseDate(raw: string): string | null {
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return raw;
    }

    // Try DD/MM/YYYY
    const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const d = new Date(formatted);
      if (!isNaN(d.getTime())) return formatted;
    }

    return null;
  }

  private parseStatus(raw: string): AttendanceStatus | null {
    const lower = raw.toLowerCase().trim();
    const mapping: Record<string, AttendanceStatus> = {
      'đi làm': AttendanceStatus.PRESENT,
      'present': AttendanceStatus.PRESENT,
      'có mặt': AttendanceStatus.PRESENT,
      'muộn': AttendanceStatus.LATE,
      'đi muộn': AttendanceStatus.LATE,
      'late': AttendanceStatus.LATE,
      'vắng': AttendanceStatus.ABSENT,
      'vắng mặt': AttendanceStatus.ABSENT,
      'absent': AttendanceStatus.ABSENT,
      'nghỉ phép': AttendanceStatus.LEAVE,
      'nghỉ': AttendanceStatus.LEAVE,
      'leave': AttendanceStatus.LEAVE,
      'nửa ngày': AttendanceStatus.HALF_DAY,
      'half': AttendanceStatus.HALF_DAY,
      'half_day': AttendanceStatus.HALF_DAY,
    };
    return mapping[lower] || null;
  }

  private getCoefficient(status: AttendanceStatus): number {
    switch (status) {
      case AttendanceStatus.PRESENT:
      case AttendanceStatus.LATE:
        return 1;
      case AttendanceStatus.HALF_DAY:
        return 0.5;
      case AttendanceStatus.LEAVE:
      case AttendanceStatus.ABSENT:
        return 0;
      default:
        return 1;
    }
  }
}

interface ParsedAttendanceRow {
  rowNumber: number;
  employeeCode: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  statusRaw: string;
  overtimeRaw: string;
  note: string | null;
}
