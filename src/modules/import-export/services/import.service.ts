import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Workbook } from 'exceljs';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { GradeEntity } from '../../class/entities/grade.entity';
import { DepartmentEntity } from '../../department/entities/department.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TimetableSlotEntity } from '../../timetable/entities/timetable-slot.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { AcademicYearEntity } from '../../academic/entities/academic-year.entity';
import { ImportResultDto, ImportError } from '../dto/import-result.dto';
import { ImportProcessor } from '../processors/import.processor';
import { Gender } from '../../../common/enums/status.enum';

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
    @InjectRepository(DepartmentEntity)
    private readonly departmentRepo: Repository<DepartmentEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
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

    for (const row of parsedRows) {
      if (row.errors.length > 0) {
        allErrors.push(...row.errors);
        continue;
      }

      const employeeCode = row.data['employeeCode'] as string;
      if (!employeeCode) {
        allErrors.push({
          row: row.rowNumber,
          field: 'employeeCode',
          message: 'Trường "Mã NV" là bắt buộc',
          value: '',
        });
        continue;
      }

      // Check duplicate employeeCode
      const existing = await this.teacherRepo.findOne({
        where: {
          employeeCode,
          schoolId,
          deletedAt: IsNull(),
        },
      });

      if (existing) {
        allErrors.push({
          row: row.rowNumber,
          field: 'employeeCode',
          message: `Mã nhân viên "${employeeCode}" đã tồn tại`,
          value: employeeCode,
        });
        continue;
      }

      // Lookup grade by name if provided
      let gradeId: string | null = null;
      const gradeName = row.data['gradeName'] as string | null;
      if (gradeName) {
        const grade = await this.gradeRepo.findOne({
          where: { name: gradeName, schoolId },
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
        gradeId = grade.id;
      }

      // Lookup department by name if provided
      let departmentId: string | null = null;
      const departmentName = row.data['departmentName'] as string | null;
      if (departmentName) {
        const department = await this.departmentRepo.findOne({
          where: { name: departmentName, schoolId },
        });
        if (!department) {
          allErrors.push({
            row: row.rowNumber,
            field: 'departmentName',
            message: `Không tìm thấy tổ/môn "${departmentName}"`,
            value: departmentName,
          });
          continue;
        }
        departmentId = department.id;
      }

      // Parse gender
      let gender: Gender | null = null;
      const genderRaw = row.data['gender'] as string | null;
      if (genderRaw) {
        const genderLower = genderRaw.toLowerCase().trim();
        if (genderLower === 'nam' || genderLower === 'male') {
          gender = Gender.MALE;
        } else if (genderLower === 'nữ' || genderLower === 'nu' || genderLower === 'female') {
          gender = Gender.FEMALE;
        } else if (genderLower === 'khác' || genderLower === 'khac' || genderLower === 'other') {
          gender = Gender.OTHER;
        }
      }

      // Parse maxPeriodsPerWeek
      const maxPeriodsPerWeek = row.data['maxPeriodsPerWeek']
        ? Number(row.data['maxPeriodsPerWeek'])
        : 20;

      try {
        const teacher = this.teacherRepo.create({
          schoolId,
          employeeCode,
          fullName: row.data['fullName'] as string,
          shortName: (row.data['shortName'] as string) || null,
          gradeId,
          departmentId,
          jobTitle: (row.data['jobTitle'] as string) || null,
          managementLevel: (row.data['managementLevel'] as string) || null,
          gender,
          maxPeriodsPerWeek,
        });

        await this.teacherRepo.save(teacher);
        successCount++;
      } catch (saveError: unknown) {
        const errMsg = saveError instanceof Error ? saveError.message : 'Lỗi không xác định khi lưu';
        allErrors.push({
          row: row.rowNumber,
          field: 'save',
          message: errMsg,
          value: employeeCode,
        });
      }
    }

    return {
      totalRows: parsedRows.length,
      successCount,
      errorCount: allErrors.length > 0 ? parsedRows.length - successCount : 0,
      errors: allErrors,
    };
  }

  async importDepartments(
    file: Express.Multer.File,
    schoolId: string,
  ): Promise<ImportResultDto> {
    this.validateFile(file);

    const workbook = await this.importProcessor.parseExcelFile(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    const columnMappings = this.importProcessor.getDepartmentColumnMappings();
    const parsedRows = this.importProcessor.parseWorksheet(worksheet, columnMappings);

    const allErrors: ImportError[] = [];
    let successCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const row of parsedRows) {
        if (row.errors.length > 0) {
          allErrors.push(...row.errors);
          continue;
        }

        const name = row.data['name'] as string;

        // Determine effective schoolId: if schoolCode is provided, look up the school
        let effectiveSchoolId = schoolId;
        const schoolCode = row.data['schoolCode'] as string | null;
        if (schoolCode) {
          const school = await manager.findOne(SchoolEntity, {
            where: { code: schoolCode, deletedAt: IsNull() },
          });
          if (!school) {
            allErrors.push({
              row: row.rowNumber,
              field: 'schoolCode',
              message: `Không tìm thấy trường với mã "${schoolCode}"`,
              value: schoolCode,
            });
            continue;
          }
          effectiveSchoolId = school.id;
        }

        // Check duplicate department name within school
        const existing = await manager.findOne(DepartmentEntity, {
          where: {
            name,
            schoolId: effectiveSchoolId,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          allErrors.push({
            row: row.rowNumber,
            field: 'name',
            message: `Tổ bộ môn "${name}" đã tồn tại trong trường`,
            value: name,
          });
          continue;
        }

        // Lookup headTeacher by employeeCode if provided
        let headTeacherId: string | null = null;
        const headTeacherCode = row.data['headTeacherCode'] as string | null;
        if (headTeacherCode) {
          const teacher = await manager.findOne(TeacherEntity, {
            where: {
              employeeCode: headTeacherCode,
              schoolId: effectiveSchoolId,
              deletedAt: IsNull(),
            },
          });
          if (!teacher) {
            allErrors.push({
              row: row.rowNumber,
              field: 'headTeacherCode',
              message: `Không tìm thấy giáo viên với mã NV "${headTeacherCode}"`,
              value: headTeacherCode,
            });
            continue;
          }
          headTeacherId = teacher.id;
        }

        try {
          const department = manager.create(DepartmentEntity, {
            schoolId: effectiveSchoolId,
            name,
            headTeacherId,
          });

          await manager.save(department);
          successCount++;
        } catch (saveError: unknown) {
          const errMsg = saveError instanceof Error ? saveError.message : 'Lỗi không xác định khi lưu';
          allErrors.push({
            row: row.rowNumber,
            field: 'save',
            message: errMsg,
            value: name,
          });
        }
      }
    });

    return {
      totalRows: parsedRows.length,
      successCount,
      errorCount: parsedRows.length - successCount,
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
    let colorIndex = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const row of parsedRows) {
        if (row.errors.length > 0) {
          allErrors.push(...row.errors);
          continue;
        }

        const name = row.data['name'] as string;
        // Auto-generate code from name (uppercase initials of words)
        const code = name
          .split(/\s+/)
          .map((w: string) => w.charAt(0).toUpperCase())
          .join('') || name.substring(0, 5).toUpperCase();

        // Check duplicate name within school
        const existing = await manager.findOne(SubjectEntity, {
          where: {
            name,
            schoolId,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          allErrors.push({
            row: row.rowNumber,
            field: 'name',
            message: `Môn học "${name}" đã tồn tại`,
            value: name,
          });
          continue;
        }

        // Auto-generate color
        const colorCode = this.generateSubjectColor(colorIndex);
        colorIndex++;

        const subject = manager.create(SubjectEntity, {
          schoolId,
          code,
          name,
          periodsPerWeek: row.data['periodsPerWeek']
            ? Number(row.data['periodsPerWeek'])
            : 6,
          colorCode,
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
      case 'departments':
        this.buildDepartmentTemplate(worksheet);
        break;
      default:
        throw new BadRequestException(`Loại template "${type}" không hợp lệ. Chấp nhận: teachers, subjects, classes, timetable, departments`);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private buildTeacherTemplate(worksheet: import('exceljs').Worksheet): void {
    worksheet.columns = [
      { header: 'Mã NV', key: 'employeeCode', width: 15 },
      { header: 'Họ và Tên', key: 'fullName', width: 25 },
      { header: 'Tên gọi', key: 'shortName', width: 15 },
      { header: 'Khối', key: 'gradeName', width: 15 },
      { header: 'Tổ bộ môn', key: 'departmentName', width: 20 },
      { header: 'Chức danh/chức vụ', key: 'jobTitle', width: 20 },
      { header: 'Cấp bậc quản lý', key: 'managementLevel', width: 18 },
      { header: 'Giới tính', key: 'gender', width: 12 },
      { header: 'Max tiết/tuần', key: 'maxPeriodsPerWeek', width: 15 },
    ];

    // Add sample row
    worksheet.addRow({
      employeeCode: '001176019610',
      fullName: 'Nguyễn Thị Lan Hương',
      shortName: 'Lan Hương -T',
      gradeName: 'THCS',
      departmentName: 'TOÁN',
      jobTitle: 'GVCN 7D0, GVBM',
      managementLevel: 'Tổ trưởng, Nhóm trưởng',
      gender: 'Nữ',
      maxPeriodsPerWeek: 20,
    });

    this.styleHeaderRow(worksheet);
  }

  private buildSubjectTemplate(worksheet: import('exceljs').Worksheet): void {
    worksheet.columns = [
      { header: 'Môn học', key: 'name', width: 25 },
      { header: 'Số tiết/tuần', key: 'periodsPerWeek', width: 15 },
    ];

    worksheet.addRow({
      name: 'Toán học',
      periodsPerWeek: 6,
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

  private buildDepartmentTemplate(worksheet: import('exceljs').Worksheet): void {
    worksheet.columns = [
      { header: 'Tổ bộ môn', key: 'name', width: 25 },
      { header: 'Mã Trường', key: 'schoolCode', width: 15 },
      { header: 'Tên Trường', key: 'schoolName', width: 30 },
      { header: 'Tên Tổ trưởng', key: 'headTeacherName', width: 25 },
      { header: 'Mã NV Tổ trưởng', key: 'headTeacherCode', width: 18 },
    ];

    worksheet.addRow({
      name: 'TOÁN',
      schoolCode: 'DMS',
      schoolName: 'Diamond School',
      headTeacherName: 'Nguyễn Thị Lan Hương',
      headTeacherCode: '001176019610',
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

  private generateSubjectColor(index: number): string {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
      '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
      '#eab308', '#d946ef', '#0891b2', '#65a30d', '#dc2626',
    ];
    return colors[index % colors.length];
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
