import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableStatus } from '../../../common/enums/status.enum';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { RoomEntity } from '../../room/entities/room.entity';
import {
  ImportTimetableOptions,
  ParsedTimetableRow,
  TimetableImportResult,
  ValidatedSlotData,
  TimetableImportError,
} from '../interfaces/timetable-import.interface';

@Injectable()
export class TimetableImportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly versionRepo: TimetableVersionRepository,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(PeriodDefinitionEntity)
    private readonly periodRepo: Repository<PeriodDefinitionEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,
  ) {}

  /**
   * Import TKB từ file Excel.
   * Validate file → parse rows → validate data → lookup entities → create version + slots.
   *
   * @param options - File Excel, schoolId, semesterId
   * @returns TimetableImportResult với thống kê import và danh sách lỗi
   */
  async importFromExcel(options: ImportTimetableOptions): Promise<TimetableImportResult> {
    const { file, schoolId, semesterId } = options;

    // 1. Validate file type
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('File phải có định dạng Excel (.xlsx hoặc .xls)');
    }

    // 2. Validate file size (≤ 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Kích thước file tối đa là 10MB');
    }

    // 3. Parse Excel rows
    const parsedRows = await this.parseExcelRows(file.buffer);

    // 4. Check empty file (no data rows)
    if (parsedRows.length === 0) {
      throw new BadRequestException('File không chứa dữ liệu để import');
    }

    // 5. Validate rows (basic validation + duplicate detection)
    const { validRows, validRowIndices, errors: validationErrors } = this.validateRows(parsedRows);

    // 6. Lookup entities for valid rows (pass original indices for correct error row numbers)
    const { validSlots, errors: lookupErrors } = await this.lookupEntities(
      validRows,
      schoolId,
      validRowIndices,
    );

    // 7. Combine all errors
    const allErrors = [...validationErrors, ...lookupErrors];
    const totalRows = parsedRows.length;
    const successCount = validSlots.length;
    const errorCount = totalRows - successCount;

    // 8. If ≥1 valid slot → create version + insert slots in transaction
    let versionId: string | null = null;
    let versionName: string | null = null;

    if (validSlots.length > 0) {
      const versionNumber = await this.versionRepo.getNextVersionNumber(semesterId);
      const name = `Import TKB - v${versionNumber}`;

      const version = await this.dataSource.transaction(async (manager) => {
        // Create version
        const versionEntity = manager.create(TimetableVersionEntity, {
          semesterId,
          name,
          versionNumber,
          status: TimetableStatus.DRAFT,
        });
        const savedVersion = await manager.save(TimetableVersionEntity, versionEntity);

        // Bulk insert slots
        const slotEntities = validSlots.map((slot) =>
          manager.create(TimetableSlotEntity, {
            versionId: savedVersion.id,
            classId: slot.classId,
            dayOfWeek: slot.dayOfWeek,
            periodId: slot.periodId,
            subjectId: slot.subjectId,
            teacherId: slot.teacherId,
            roomId: slot.roomId || null,
            isDoublePeriod: false,
          }),
        );
        await manager.save(TimetableSlotEntity, slotEntities);

        return savedVersion;
      });

      versionId = version.id;
      versionName = version.name;
    }

    return {
      totalRows,
      successCount,
      errorCount,
      errors: allErrors,
      versionId,
      versionName,
    };
  }

  /**
   * Đọc file Excel buffer và parse từng dòng dữ liệu bắt đầu từ dòng 2 (skip header).
   * Template chuẩn gồm 6 cột: Lớp, Thứ, Tiết, Môn, GV, Phòng
   *
   * @param buffer - Buffer chứa nội dung file Excel
   * @returns Array ParsedTimetableRow[] - Dữ liệu thô sau khi parse
   */
  async parseExcelRows(buffer: Buffer): Promise<ParsedTimetableRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }

    const rows: ParsedTimetableRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // Skip header row (row 1)
      if (rowNumber === 1) {
        return;
      }

      const className = this.getCellStringValue(row.getCell(1));
      const dayOfWeek = this.getCellNumberValue(row.getCell(2));
      const periodNumber = this.getCellNumberValue(row.getCell(3));
      const subjectCode = this.getCellStringValue(row.getCell(4));
      const teacherCode = this.getCellStringValue(row.getCell(5));
      const roomCode = this.getCellStringValue(row.getCell(6));

      rows.push({
        className,
        dayOfWeek,
        periodNumber,
        subjectCode,
        teacherCode,
        roomCode,
      });
    });

    return rows;
  }

  /**
   * Validate dữ liệu parsed rows trước khi tra cứu entity.
   * Kiểm tra các ràng buộc cơ bản và phát hiện trùng lặp tổ hợp Lớp+Thứ+Tiết.
   *
   * @param rows - Array các dòng đã parse từ Excel
   * @returns Object chứa validRows (rows hợp lệ), validRowIndices (chỉ số gốc trong parsedRows), và errors (danh sách lỗi)
   */
  validateRows(rows: ParsedTimetableRow[]): {
    validRows: ParsedTimetableRow[];
    validRowIndices: number[];
    errors: TimetableImportError[];
  } {
    const validRows: ParsedTimetableRow[] = [];
    const validRowIndices: number[] = [];
    const errors: TimetableImportError[] = [];
    const seenCombinations = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const excelRowNumber = i + 2; // Row 1 is header
      const rowErrors: TimetableImportError[] = [];

      // Check className not empty
      if (!row.className) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Lớp',
          message: 'Tên lớp không được để trống',
          value: '',
        });
      }

      // Check dayOfWeek in [2, 7]
      if (row.dayOfWeek < 2 || row.dayOfWeek > 7) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Thứ',
          message: 'Giá trị Thứ phải từ 2 đến 7',
          value: String(row.dayOfWeek),
        });
      }

      // Check periodNumber > 0
      if (row.periodNumber <= 0) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Tiết',
          message: 'Số tiết phải lớn hơn 0',
          value: String(row.periodNumber),
        });
      }

      // Check subjectCode not empty
      if (!row.subjectCode) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Môn',
          message: 'Mã môn không được để trống',
          value: '',
        });
      }

      // Check teacherCode not empty
      if (!row.teacherCode) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Giáo viên',
          message: 'Mã giáo viên không được để trống',
          value: '',
        });
      }

      // Duplicate detection: className + dayOfWeek + periodNumber
      if (rowErrors.length === 0) {
        const combination = `${row.className}-${row.dayOfWeek}-${row.periodNumber}`;
        if (seenCombinations.has(combination)) {
          rowErrors.push({
            row: excelRowNumber,
            field: 'Lớp+Thứ+Tiết',
            message: 'Trùng lặp tổ hợp Lớp+Thứ+Tiết trong file',
            value: `${row.className}-Thứ ${row.dayOfWeek}-Tiết ${row.periodNumber}`,
          });
        } else {
          seenCombinations.add(combination);
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRows.push(row);
        validRowIndices.push(i);
      }
    }

    return { validRows, validRowIndices, errors };
  }

  /**
   * Tra cứu entity cho từng dòng đã parse, scoped theo school_id.
   * Sử dụng batch pre-loading cho hiệu suất O(1) lookup.
   *
   * @param rows - Array các dòng đã parse và validate cơ bản
   * @param schoolId - ID trường (multi-tenant scoping)
   * @param originalIndices - Chỉ số gốc của từng row trong parsedRows array (để tính đúng Excel row number)
   * @returns Object chứa validSlots (rows đã map thành UUID) và errors (lookup failures)
   */
  async lookupEntities(
    rows: ParsedTimetableRow[],
    schoolId: string,
    originalIndices?: number[],
  ): Promise<{ validSlots: ValidatedSlotData[]; errors: TimetableImportError[] }> {
    const validSlots: ValidatedSlotData[] = [];
    const errors: TimetableImportError[] = [];

    // Batch pre-load all entities for this school (O(1) lookup via Maps)
    const [teachers, subjects, classes, periods, rooms] = await Promise.all([
      this.teacherRepo.find({ where: { schoolId, deletedAt: IsNull() } }),
      this.subjectRepo.find({ where: { schoolId, deletedAt: IsNull() } }),
      this.classRepo.find({ where: { schoolId, deletedAt: IsNull() } }),
      this.periodRepo.find({ where: { schoolId, deletedAt: IsNull() } }),
      this.roomRepo.find({ where: { schoolId, deletedAt: IsNull() } }),
    ]);

    const teacherMap = new Map(teachers.map((t) => [t.employeeCode, t]));
    const subjectMap = new Map(subjects.map((s) => [s.code, s]));
    const classMap = new Map(classes.map((c) => [c.name, c]));
    const periodMap = new Map(periods.map((p) => [p.periodNumber, p]));
    const roomMap = new Map(rooms.map((r) => [r.code, r]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Use original index if provided, otherwise fallback to sequential index
      const originalIndex = originalIndices ? originalIndices[i] : i;
      const excelRowNumber = originalIndex + 2; // Row 1 is header, data starts at row 2
      const rowErrors: TimetableImportError[] = [];

      // Lookup teacher by employeeCode
      const teacher = teacherMap.get(row.teacherCode);
      if (!teacher) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Giáo viên',
          message: `Không tìm thấy giáo viên với mã ${row.teacherCode}`,
          value: row.teacherCode,
        });
      }

      // Lookup subject by code
      const subject = subjectMap.get(row.subjectCode);
      if (!subject) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Môn',
          message: `Không tìm thấy môn học với mã ${row.subjectCode}`,
          value: row.subjectCode,
        });
      }

      // Lookup class by name
      const classEntity = classMap.get(row.className);
      if (!classEntity) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Lớp',
          message: `Không tìm thấy lớp ${row.className}`,
          value: row.className,
        });
      }

      // Lookup period by periodNumber
      const period = periodMap.get(row.periodNumber);
      if (!period) {
        rowErrors.push({
          row: excelRowNumber,
          field: 'Tiết',
          message: `Tiết ${row.periodNumber} không hợp lệ`,
          value: String(row.periodNumber),
        });
      }

      // Lookup room by code (only if roomCode is provided)
      let roomId: string | undefined;
      if (row.roomCode) {
        const room = roomMap.get(row.roomCode);
        if (!room) {
          rowErrors.push({
            row: excelRowNumber,
            field: 'Phòng',
            message: `Không tìm thấy phòng với mã ${row.roomCode}`,
            value: row.roomCode,
          });
        } else {
          roomId = room.id;
        }
      }

      // If all lookups succeed, add to validSlots
      if (rowErrors.length === 0) {
        validSlots.push({
          classId: classEntity!.id,
          dayOfWeek: row.dayOfWeek,
          periodId: period!.id,
          subjectId: subject!.id,
          teacherId: teacher!.id,
          ...(roomId && { roomId }),
        });
      } else {
        errors.push(...rowErrors);
      }
    }

    return { validSlots, errors };
  }

  /**
   * Tạo file Excel template chuẩn cho import TKB.
   * Template gồm 6 cột: Lớp, Thứ, Tiết, Môn, Giáo viên, Phòng và 1 dòng dữ liệu mẫu.
   *
   * @returns Buffer chứa nội dung file Excel template
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NBK_EMS';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Template Import TKB');

    // Header row
    worksheet.columns = [
      { header: 'Lớp', key: 'class', width: 15 },
      { header: 'Thứ', key: 'day', width: 8 },
      { header: 'Tiết', key: 'period', width: 8 },
      { header: 'Môn', key: 'subject', width: 15 },
      { header: 'Giáo viên', key: 'teacher', width: 15 },
      { header: 'Phòng', key: 'room', width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };

    // Sample data row
    worksheet.addRow({
      class: '10A1',
      day: 2,
      period: 1,
      subject: 'TOAN',
      teacher: 'GV001',
      room: 'P101',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  /**
   * Lấy giá trị string từ cell Excel, trả về chuỗi rỗng nếu null/undefined
   */
  private getCellStringValue(cell: ExcelJS.Cell): string {
    const value = cell.value;
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  /**
   * Lấy giá trị number từ cell Excel, trả về 0 nếu không parse được
   */
  private getCellNumberValue(cell: ExcelJS.Cell): number {
    const value = cell.value;
    if (value === null || value === undefined) {
      return 0;
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }
}
