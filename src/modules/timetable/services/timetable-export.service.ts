import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { ClassEntity } from '../../class/entities/class.entity';
import { GradeEntity } from '../../class/entities/grade.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { SemesterEntity } from '../../academic/entities/semester.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';

export interface ExportResult {
  buffer: Buffer;
  filename: string;
}

interface TimetableCell {
  subjectName: string;
  teacherName: string;
}

interface ExportOptions {
  versionId: string;
  gradeId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

const DAY_NAMES: Record<number, string> = {
  2: 'Hai',
  3: 'Ba',
  4: 'Tư',
  5: 'Năm',
  6: 'Sáu',
  7: 'Bảy',
};

const DAYS_ORDER = [2, 3, 4, 5, 6, 7]; // Thứ 2 → Thứ 7

@Injectable()
export class TimetableExportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly slotRepo: TimetableSlotRepository,
    private readonly versionRepo: TimetableVersionRepository,
  ) {}

  async exportToExcel(options: ExportOptions): Promise<ExportResult> {
    const version = await this.versionRepo.findById(options.versionId);
    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }

    // Get semester info
    const semester = await this.dataSource.getRepository(SemesterEntity).findOne({
      where: { id: version.semesterId },
      relations: { academicYear: true },
    });

    // Get all slots with relations
    const slots = await this.slotRepo.findByVersion(options.versionId);

    // Validate version is not empty (0 slots)
    if (!slots || slots.length === 0) {
      throw new BadRequestException('TKB trống, không có dữ liệu để xuất');
    }

    // Group slots by grade
    const classRepo = this.dataSource.getRepository(ClassEntity);
    const gradeRepo = this.dataSource.getRepository(GradeEntity);

    let grades: GradeEntity[];
    let gradeName: string | null = null;
    if (options.gradeId) {
      const grade = await gradeRepo.findOne({ where: { id: options.gradeId } });
      grades = grade ? [grade] : [];
      gradeName = grade?.name || null;
    } else {
      grades = await gradeRepo.find({ order: { level: 'ASC' } });
    }

    // Get school info
    const school = semester?.academicYear
      ? await this.dataSource.getRepository(SchoolEntity).findOne({
          where: { id: semester.academicYear.schoolId },
        })
      : null;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NBK_EMS';
    workbook.created = new Date();

    for (const grade of grades) {
      // Get classes in grade
      const classes = await classRepo.find({
        where: { gradeId: grade.id },
        order: { name: 'ASC' },
      });

      if (classes.length === 0) continue;

      // Filter slots for classes in this grade
      const classIds = classes.map(c => c.id);
      const gradeSlots = slots.filter(s => classIds.includes(s.classId));

      // Determine max periods per day from slots
      const periodNumbers = [...new Set(gradeSlots.map(s => s.period?.periodNumber || 0))].sort((a, b) => a - b);
      const maxPeriods = periodNumbers.length > 0 ? Math.max(...periodNumbers) : 8;

      await this.buildGradeSheet(
        workbook,
        grade,
        classes,
        gradeSlots,
        maxPeriods,
        school?.name || '',
        semester?.semesterNumber || 1,
        semester?.academicYear?.name || '',
        options.effectiveFrom,
        options.effectiveTo,
      );
    }

    // Add "Mã môn học" sheet
    await this.buildSubjectCodeSheet(workbook, slots);

    // Add "Mã giáo viên" sheet
    await this.buildTeacherCodeSheet(workbook, slots);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const filename = this.generateFilename(gradeName, new Date());

    return { buffer, filename };
  }

  private async buildGradeSheet(
    workbook: ExcelJS.Workbook,
    grade: GradeEntity,
    classes: ClassEntity[],
    slots: TimetableSlotEntity[],
    maxPeriods: number,
    schoolName: string,
    semesterNumber: number,
    academicYearName: string,
    effectiveFrom?: string,
    effectiveTo?: string,
  ): Promise<void> {
    const sheet = workbook.addWorksheet(`Khối ${grade.level}`);

    // Column widths
    sheet.getColumn(1).width = 8;  // Thứ
    sheet.getColumn(2).width = 5;  // Tiết
    for (let i = 0; i < classes.length; i++) {
      sheet.getColumn(3 + i * 2).width = 10;     // Môn
      sheet.getColumn(4 + i * 2).width = 12;     // GV
    }

    let row = 1;

    // Header: School name
    sheet.getCell(row, 1).value = 'TRƯỜNG';
    sheet.getCell(row, 2).value = schoolName;
    sheet.mergeCells(row, 2, row, 2 + classes.length * 2 - 1);
    sheet.getRow(row).font = { bold: true, size: 12 };
    row++;

    // Header: TKB title
    sheet.getCell(row, 1).value = `THỜI KHÓA BIỂU HỌC KỲ ${semesterNumber === 1 ? 'I' : 'II'} KHỐI ${grade.level} - NĂM HỌC ${academicYearName}`;
    sheet.mergeCells(row, 1, row, 2 + classes.length * 2 - 1);
    sheet.getRow(row).font = { bold: true, size: 14 };
    sheet.getRow(row).alignment = { horizontal: 'center' };
    row++;

    // Header: LỚP row
    sheet.getCell(row, 1).value = 'Thứ';
    sheet.getCell(row, 2).value = 'Tiết';
    for (let i = 0; i < classes.length; i++) {
      sheet.mergeCells(row, 3 + i * 2, row, 4 + i * 2);
      sheet.getCell(row, 3 + i * 2).value = classes[i].name;
      sheet.getCell(row, 3 + i * 2).alignment = { horizontal: 'center' };
    }
    sheet.getRow(row).font = { bold: true };
    row++;

    // Sub-header: Môn / GV
    sheet.getCell(row, 1).value = '';
    sheet.getCell(row, 2).value = '';
    for (let i = 0; i < classes.length; i++) {
      sheet.getCell(row, 3 + i * 2).value = 'Môn';
      sheet.getCell(row, 4 + i * 2).value = 'GV';
    }
    sheet.getRow(row).font = { bold: true, italic: true };
    row++;

    // Build slot lookup: key = "classId-dayOfWeek-periodNumber"
    const slotMap = new Map<string, TimetableCell>();
    for (const slot of slots) {
      const periodNum = slot.period?.periodNumber || 0;
      const key = `${slot.classId}-${slot.dayOfWeek}-${periodNum}`;
      slotMap.set(key, {
        subjectName: slot.subject?.shortName || slot.subject?.code || slot.subject?.name || '',
        teacherName: slot.teacher?.shortName || slot.teacher?.fullName || '',
      });
    }

    // Body: Thứ → Tiết → Lớp data
    for (const day of DAYS_ORDER) {
      for (let period = 1; period <= maxPeriods; period++) {
        const currentRow = row;

        // Thứ column (only on first period of the day)
        if (period === 1) {
          sheet.getCell(currentRow, 1).value = DAY_NAMES[day];
          // Merge vertically for all periods of the day
          if (maxPeriods > 1) {
            sheet.mergeCells(currentRow, 1, currentRow + maxPeriods - 1, 1);
          }
          sheet.getCell(currentRow, 1).alignment = { vertical: 'middle', horizontal: 'center' };
          sheet.getCell(currentRow, 1).font = { bold: true };
        }

        // Tiết column
        sheet.getCell(currentRow, 2).value = period;
        sheet.getCell(currentRow, 2).alignment = { horizontal: 'center' };

        // Lớp data
        for (let i = 0; i < classes.length; i++) {
          const key = `${classes[i].id}-${day}-${period}`;
          const cell = slotMap.get(key);

          sheet.getCell(currentRow, 3 + i * 2).value = cell?.subjectName || '';
          sheet.getCell(currentRow, 4 + i * 2).value = cell?.teacherName || '';
          sheet.getCell(currentRow, 3 + i * 2).alignment = { horizontal: 'center' };
          sheet.getCell(currentRow, 4 + i * 2).alignment = { horizontal: 'center' };
        }

        row++;
      }
    }

    // Footer: Thời gian áp dụng
    row++;
    sheet.getCell(row, 1).value = 'Thời gian áp dụng:';
    sheet.getCell(row, 3).value = 'Từ ngày';
    sheet.getCell(row, 4).value = effectiveFrom || '';
    sheet.getCell(row, 5).value = 'đến ngày';
    sheet.getCell(row, 6).value = effectiveTo || '';

    // Apply borders to data area
    const dataStartRow = 3;
    const dataEndRow = row - 1;
    const dataEndCol = 2 + classes.length * 2;

    for (let r = dataStartRow; r <= dataEndRow; r++) {
      for (let c = 1; c <= dataEndCol; c++) {
        const cell = sheet.getCell(r, c);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }
  }

  private async buildSubjectCodeSheet(workbook: ExcelJS.Workbook, slots: TimetableSlotEntity[]): Promise<void> {
    const sheet = workbook.addWorksheet('Mã môn học');

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 30;

    sheet.getCell(1, 1).value = 'STT';
    sheet.getCell(1, 2).value = 'Mã môn học';
    sheet.getCell(1, 3).value = 'Tên môn học trên TKB';
    sheet.getRow(1).font = { bold: true };

    // Unique subjects
    const subjectMap = new Map<string, { code: string; name: string; shortName: string }>();
    for (const slot of slots) {
      if (slot.subject && !subjectMap.has(slot.subjectId)) {
        subjectMap.set(slot.subjectId, {
          code: slot.subject.code,
          name: slot.subject.name,
          shortName: slot.subject.shortName || slot.subject.code,
        });
      }
    }

    let row = 2;
    let stt = 1;
    for (const [, subject] of subjectMap) {
      sheet.getCell(row, 1).value = stt++;
      sheet.getCell(row, 2).value = subject.code;
      sheet.getCell(row, 3).value = subject.shortName;
      row++;
    }
  }

  private async buildTeacherCodeSheet(workbook: ExcelJS.Workbook, slots: TimetableSlotEntity[]): Promise<void> {
    const sheet = workbook.addWorksheet('Mã giáo viên');

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 30;
    sheet.getColumn(4).width = 20;

    sheet.getCell(1, 1).value = 'STT';
    sheet.getCell(1, 2).value = 'Mã nhân viên';
    sheet.getCell(1, 3).value = 'Tên đầy đủ';
    sheet.getCell(1, 4).value = 'Tên trên TKB';
    sheet.getRow(1).font = { bold: true };

    // Unique teachers
    const teacherMap = new Map<string, { code: string; fullName: string; shortName: string }>();
    for (const slot of slots) {
      if (slot.teacher && !teacherMap.has(slot.teacherId)) {
        teacherMap.set(slot.teacherId, {
          code: slot.teacher.employeeCode,
          fullName: slot.teacher.fullName,
          shortName: slot.teacher.shortName || this.getTeacherShortName(slot.teacher.fullName),
        });
      }
    }

    let row = 2;
    let stt = 1;
    for (const [, teacher] of teacherMap) {
      sheet.getCell(row, 1).value = stt++;
      sheet.getCell(row, 2).value = teacher.code;
      sheet.getCell(row, 3).value = teacher.fullName;
      sheet.getCell(row, 4).value = teacher.shortName;
      row++;
    }
  }

  /**
   * Generate export filename following format: TKB_{gradeName or TatCa}_{YYYY-MM-DD}.xlsx
   * Removes diacritics and special characters from gradeName for filename safety.
   */
  generateFilename(gradeName: string | null, exportDate: Date): string {
    const safeName = gradeName
      ? this.removeDiacritics(gradeName).replace(/[^a-zA-Z0-9]/g, '')
      : 'TatCa';

    const year = exportDate.getFullYear();
    const month = String(exportDate.getMonth() + 1).padStart(2, '0');
    const day = String(exportDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return `TKB_${safeName}_${dateStr}.xlsx`;
  }

  /**
   * Remove Vietnamese diacritics from a string.
   */
  private removeDiacritics(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  /**
   * Lấy tên hiển thị trên TKB:
   * Ưu tiên field shortName (do trường tự quy định).
   * Nếu chưa có thì fallback tự sinh từ họ tên.
   */
  private getTeacherShortName(fullName: string): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];

    const lastName = parts[parts.length - 1];
    const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase()).join('.');
    return `${lastName} ${initials}`;
  }
}
