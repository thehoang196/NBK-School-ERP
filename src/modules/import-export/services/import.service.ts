import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Workbook } from 'exceljs';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { GradeEntity } from '../../class/entities/grade.entity';
import { TimetableSlotEntity } from '../../timetable/entities/timetable-slot.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { AcademicYearEntity } from '../../academic/entities/academic-year.entity';
import { ImportResultDto, ImportError } from '../dto/import-result.dto';
import { ImportProcessor } from '../processors/import.processor';

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(GradeEntity)
    private readonly gradeRepo: Repository<GradeEntity>,
    @InjectRepository(TimetableSlotEntity)
    private readonly timetableSlotRepo: Repository<TimetableSlotEntity>,
    @InjectRepository(PeriodDefinitionEntity)
    private readonly periodRepo: Repository<PeriodDefinitionEntity>,
    @InjectRepository(AcademicYearEntity)
    private readonly academicYearRepo: Repository<AcademicYearEntity>,
    private readonly dataSource: DataSource,
    private readonly importProcessor: ImportProcessor,
  ) {}

  async importTeachers(
    file: Express.Multer.File,
    schoolId: string,
  ): Promise<ImportResultDto> {
    this.validateFile(file);

    const workbook = await this.importProcessor.parseExcelFile(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    const columnMappings = this.importProcessor.getTeacherColumnMappings();
    const parsedRows = this.importProcessor.parseWorksheet(worksheet, columnMappings);

    const allErrors: ImportError[] = [];
    let successCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const row of parsedRows) {
        if (row.errors.length > 0) {
          allErrors.push(...row.errors);
          continue;
        }

        // Check duplicate employeeCode
        const existing = await manager.findOne(TeacherEntity, {
          where: {
            employeeCode: row.data['employeeCode'] as string,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          allErrors.push({
            row: row.rowNumber,
            field: 'employeeCode',
            message: `Mã nhân viên "${row.data['employeeCode']}" đã tồn tại`,
            value: row.data['employeeCode'] as string,
          });
          continue;
        }

        const teacher = manager.create(TeacherEntity, {
          schoolId,
          employeeCode: row.data['employeeCode'] as string,
          fullName: row.data['fullName'] as string,
          shortName: (row.data['shortName'] as string) || null,
          phone: (row.data['phone'] as string) || null,
          email: (row.data['email'] as string) || null,
          position: (row.data['position'] as string) || null,
          maxPeriodsPerWeek: row.data['maxPeriodsPerWeek']
            ? Number(row.data['maxPeriodsPerWeek'])
            : 20,
          minPeriodsPerWeek: row.data['minPeriodsPerWeek']
            ? Number(row.data['minPeriodsPerWeek'])
            : 0,
          maxPeriodsPerDay: row.data['maxPeriodsPerDay']
            ? Number(row.data['maxPeriodsPerDay'])
            : 6,
        });

        await manager.save(teacher);
        successCount++;
      }
    });

    return {
      totalRows: parsedRows.length,
      successCount,
      errorCount: allErrors.length > 0 ? parsedRows.length - successCount : 0,
      errors: allErrors,
    };
  }

  async importSubjects(
    file: Express.Multer.File,
    schoolId: string,
  ): Promise<ImportResultDto> {
    this.validateFile(file);

    const workbook = await this.importProcessor.parseExcelFile(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    const columnMappings = this.importProcessor.getSubjectColumnMappings();
    const parsedRows = this.importProcessor.parseWorksheet(worksheet, columnMappings);

    const allErrors: ImportError[] = [];
    let successCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const row of parsedRows) {
        if (row.errors.length > 0) {
          allErrors.push(...row.errors);
          continue;
        }

        // Check duplicate code
        const existing = await manager.findOne(SubjectEntity, {
          where: {
            code: row.data['code'] as string,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          allErrors.push({
            row: row.rowNumber,
            field: 'code',
            message: `Mã môn "${row.data['code']}" đã tồn tại`,
            value: row.data['code'] as string,
          });
          continue;
        }

        const subject = manager.create(SubjectEntity, {
          schoolId,
          code: row.data['code'] as string,
          name: row.data['name'] as string,
          shortName: (row.data['shortName'] as string) || null,
          periodsPerWeek: row.data['periodsPerWeek']
            ? Number(row.data['periodsPerWeek'])
            : 0,
          isDoublePeriod: row.data['isDoublePeriod'] === 'true' || row.data['isDoublePeriod'] === '1',
        });

        await manager.save(subject);
        successCount++;
      }
    });

    return {
      totalRows: parsedRows.length,
      successCount,
      errorCount: parsedRows.length - successCount,
      errors: allErrors,
    };
  }

  async importClasses(
    file: Express.Multer.File,
    schoolId: string,
  ): Promise<ImportResultDto> {
    this.validateFile(file);

    const workbook = await this.importProcessor.parseExcelFile(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    const columnMappings = this.importProcessor.getClassColumnMappings();
    const parsedRows = this.importProcessor.parseWorksheet(worksheet, columnMappings);

    const currentAcademicYear = await this.academicYearRepo.findOne({
      where: { schoolId, isCurrent: true, deletedAt: IsNull() },
    });

    if (!currentAcademicYear) {
      throw new BadRequestException(
        'Chưa có năm học hiện tại (isCurrent) cho trường này. Vui lòng thiết lập năm học trước khi import lớp.',
      );
    }

    const allErrors: ImportError[] = [];
    let successCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const row of parsedRows) {
        if (row.errors.length > 0) {
          allErrors.push(...row.errors);
          continue;
        }

        const gradeName = row.data['gradeName'] as string;
        const grade = await manager.findOne(GradeEntity, {
          where: { name: gradeName, schoolId, deletedAt: IsNull() },
        });

        if (!grade) {
          allErrors.push({
            row: row.rowNumber,
            field: 'gradeName',
            message: `Không tìm thấy khối "${gradeName}"`,
            value: gradeName,
          });
          continue;
        }

        const classEntity = manager.create(ClassEntity, {
          schoolId,
          gradeId: grade.id,
          academicYearId: currentAcademicYear.id,
          name: row.data['name'] as string,
          studentCount: row.data['studentCount']
            ? Number(row.data['studentCount'])
            : 0,
        });

        await manager.save(classEntity);
        successCount++;
      }
    });

    return {
      totalRows: parsedRows.length,
      successCount,
      errorCount: parsedRows.length - successCount,
      errors: allErrors,
    };
  }

  async importTimetable(
    file: Express.Multer.File,
    schoolId: string,
    versionId: string,
  ): Promise<ImportResultDto> {
    this.validateFile(file);

    const workbook = await this.importProcessor.parseExcelFile(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    const columnMappings = this.importProcessor.getTimetableColumnMappings();
    const parsedRows = this.importProcessor.parseWorksheet(worksheet, columnMappings);

    const allErrors: ImportError[] = [];
    let successCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const row of parsedRows) {
        if (row.errors.length > 0) {
          allErrors.push(...row.errors);
          continue;
        }

        // Lookup teacher by code
        const teacher = await manager.findOne(TeacherEntity, {
          where: {
            employeeCode: row.data['teacherCode'] as string,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (!teacher) {
          allErrors.push({
            row: row.rowNumber,
            field: 'teacherCode',
            message: `Không tìm thấy giáo viên với mã "${row.data['teacherCode']}"`,
            value: row.data['teacherCode'] as string,
          });
          continue;
        }

        // Lookup subject by code
        const subject = await manager.findOne(SubjectEntity, {
          where: {
            code: row.data['subjectCode'] as string,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (!subject) {
          allErrors.push({
            row: row.rowNumber,
            field: 'subjectCode',
            message: `Không tìm thấy môn học với mã "${row.data['subjectCode']}"`,
            value: row.data['subjectCode'] as string,
          });
          continue;
        }

        // Lookup class by name
        const classEntity = await manager.findOne(ClassEntity, {
          where: {
            name: row.data['className'] as string,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (!classEntity) {
          allErrors.push({
            row: row.rowNumber,
            field: 'className',
            message: `Không tìm thấy lớp "${row.data['className']}"`,
            value: row.data['className'] as string,
          });
          continue;
        }

        // Lookup period by periodNumber
        const periodNumber = Number(row.data['periodOrder']);
        const period = await manager.findOne(PeriodDefinitionEntity, {
          where: {
            periodNumber,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (!period) {
          allErrors.push({
            row: row.rowNumber,
            field: 'periodOrder',
            message: `Không tìm thấy tiết ${periodNumber}`,
            value: String(periodNumber),
          });
          continue;
        }

        const slot = manager.create(TimetableSlotEntity, {
          versionId,
          classId: classEntity.id,
          teacherId: teacher.id,
          subjectId: subject.id,
          dayOfWeek: Number(row.data['dayOfWeek']),
          periodId: period.id,
        });

        await manager.save(slot);
        successCount++;
      }
    });

    return {
      totalRows: parsedRows.length,
      successCount,
      errorCount: parsedRows.length - successCount,
      errors: allErrors,
    };
  }

  async generateTemplate(type: string): Promise<Buffer> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Template');

    switch (type) {
      case 'teachers':
        this.buildTeacherTemplate(worksheet);
        break;
      case 'subjects':
        this.buildSubjectTemplate(worksheet);
        break;
      case 'classes':
        this.buildClassTemplate(worksheet);
        break;
      case 'timetable':
        this.buildTimetableTemplate(worksheet);
        break;
      default:
        throw new BadRequestException(`Loại template "${type}" không hợp lệ. Chấp nhận: teachers, subjects, classes, timetable`);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private buildTeacherTemplate(worksheet: import('exceljs').Worksheet): void {
    worksheet.columns = [
      { header: 'Mã nhân viên', key: 'employeeCode', width: 15 },
      { header: 'Họ và tên', key: 'fullName', width: 25 },
      { header: 'Tên viết tắt', key: 'shortName', width: 15 },
      { header: 'Giới tính', key: 'gender', width: 12 },
      { header: 'Ngày sinh', key: 'dateOfBirth', width: 15 },
      { header: 'Số điện thoại', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Chức vụ', key: 'position', width: 15 },
      { header: 'Loại GV', key: 'teacherType', width: 15 },
      { header: 'Số tiết tối đa/tuần', key: 'maxPeriodsPerWeek', width: 18 },
      { header: 'Số tiết tối thiểu/tuần', key: 'minPeriodsPerWeek', width: 20 },
      { header: 'Số tiết tối đa/ngày', key: 'maxPeriodsPerDay', width: 18 },
    ];

    // Add sample row
    worksheet.addRow({
      employeeCode: 'GV001',
      fullName: 'Nguyễn Văn A',
      shortName: 'A',
      gender: 'male',
      dateOfBirth: '1990-01-15',
      phone: '0901234567',
      email: 'nguyenvana@school.edu.vn',
      position: 'Giáo viên',
      teacherType: 'full_time',
      maxPeriodsPerWeek: 20,
      minPeriodsPerWeek: 12,
      maxPeriodsPerDay: 6,
    });

    this.styleHeaderRow(worksheet);
  }

  private buildSubjectTemplate(worksheet: import('exceljs').Worksheet): void {
    worksheet.columns = [
      { header: 'Mã môn', key: 'code', width: 12 },
      { header: 'Tên môn', key: 'name', width: 25 },
      { header: 'Tên viết tắt', key: 'shortName', width: 15 },
      { header: 'Loại môn', key: 'subjectType', width: 15 },
      { header: 'Số tiết/tuần', key: 'periodsPerWeek', width: 15 },
      { header: 'Tiết đôi', key: 'isDoublePeriod', width: 12 },
    ];

    worksheet.addRow({
      code: 'TOAN',
      name: 'Toán học',
      shortName: 'Toán',
      subjectType: 'required',
      periodsPerWeek: 5,
      isDoublePeriod: 'false',
    });

    this.styleHeaderRow(worksheet);
  }

  private buildClassTemplate(worksheet: import('exceljs').Worksheet): void {
    worksheet.columns = [
      { header: 'Tên lớp', key: 'name', width: 15 },
      { header: 'Khối', key: 'gradeName', width: 12 },
      { header: 'Sĩ số', key: 'studentCount', width: 10 },
      { header: 'GVCN', key: 'homeroomTeacherCode', width: 15 },
    ];

    worksheet.addRow({
      name: '10A1',
      gradeName: 'Khối 10',
      studentCount: 40,
      homeroomTeacherCode: 'GV001',
    });

    this.styleHeaderRow(worksheet);
  }

  private buildTimetableTemplate(worksheet: import('exceljs').Worksheet): void {
    worksheet.columns = [
      { header: 'Lớp', key: 'className', width: 12 },
      { header: 'Thứ', key: 'dayOfWeek', width: 8 },
      { header: 'Tiết', key: 'periodOrder', width: 8 },
      { header: 'Môn', key: 'subjectCode', width: 12 },
      { header: 'Giáo viên', key: 'teacherCode', width: 15 },
      { header: 'Phòng', key: 'roomCode', width: 12 },
    ];

    worksheet.addRow({
      className: '10A1',
      dayOfWeek: 2,
      periodOrder: 1,
      subjectCode: 'TOAN',
      teacherCode: 'GV001',
      roomCode: 'P101',
    });

    this.styleHeaderRow(worksheet);
  }

  private styleHeaderRow(worksheet: import('exceljs').Worksheet): void {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên file Excel');
    }

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('File phải có định dạng Excel (.xlsx hoặc .xls)');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Kích thước file tối đa là 10MB');
    }
  }
}
