import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
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
import {
  ImportBatchEntity,
  ImportBatchStatus,
  ImportEntityType,
} from '../entities/import-batch.entity';
import { ImportBatchResponseDto } from '../dto/import-batch-response.dto';
import { ImportProcessor } from '../processors/import.processor';
import { ConflictStrategy } from '../enums/conflict-strategy.enum';
import { TeacherImportJobData } from '../processors/teacher-import.processor';
import { Gender } from '../../../common/enums/status.enum';

/** Threshold: files with more rows than this go async via queue.
 * Set high because BullMQ/Redis is currently disabled — all imports run synchronously. */
const ASYNC_THRESHOLD_ROWS = 5000;

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

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
    @InjectRepository(ImportBatchEntity)
    private readonly batchRepo: Repository<ImportBatchEntity>,
    @InjectQueue('teacher-import')
    private readonly teacherImportQueue: Queue<TeacherImportJobData>,
    private readonly dataSource: DataSource,
    private readonly importProcessor: ImportProcessor,
  ) {}

  // ─── TEACHER IMPORT ───────────────────────────────────────────────────────

  async importTeachers(
    file: Express.Multer.File,
    schoolId: string,
    conflictStrategy: ConflictStrategy = ConflictStrategy.STRICT,
    userId?: string,
  ): Promise<ImportResultDto | ImportBatchResponseDto> {
    this.validateFile(file);

    const workbook = await this.importProcessor.parseExcelFile(file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    const columnMappings = this.importProcessor.getTeacherColumnMappings();
    const parsedRows = this.importProcessor.parseWorksheet(
      worksheet,
      columnMappings,
    );

    // For large files, process asynchronously via queue
    if (parsedRows.length > ASYNC_THRESHOLD_ROWS) {
      return this.importTeachersAsync(
        file,
        schoolId,
        conflictStrategy,
        userId || 'system',
      );
    }

    // Synchronous processing for small files
    return this.importTeachersSync(
      parsedRows,
      schoolId,
      conflictStrategy,
      file,
      userId,
    );
  }

  /**
   * Async import: creates batch record and pushes job to BullMQ queue.
   * Returns batch info with status 'queued'. Client polls GET /import-batches/:id.
   */
  async importTeachersAsync(
    file: Express.Multer.File,
    schoolId: string,
    conflictStrategy: ConflictStrategy,
    userId: string,
  ): Promise<ImportBatchResponseDto> {
    const batch = this.batchRepo.create({
      schoolId,
      entityType: ImportEntityType.TEACHER,
      fileName: file.originalname || 'unknown.xlsx',
      fileSize: file.size,
      status: ImportBatchStatus.QUEUED,
      conflictStrategy,
      uploadedByUserId: userId,
      progress: 0,
    });

    const savedBatch = await this.batchRepo.save(batch);

    const jobData: TeacherImportJobData = {
      batchId: savedBatch.id,
      fileBuffer: file.buffer.toString('base64'),
      schoolId,
      conflictStrategy,
    };

    await this.teacherImportQueue.add('process-teacher-import', jobData, {
      priority: 10,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 }, // 24h
      removeOnFail: { age: 604800 }, // 7 days
    });

    this.logger.log(
      `Import batch ${savedBatch.id} queued: ${file.originalname}, ${file.size} bytes`,
    );

    return {
      batchId: savedBatch.id,
      status: ImportBatchStatus.QUEUED,
      entityType: ImportEntityType.TEACHER,
      fileName: savedBatch.fileName,
      totalRows: 0,
      successCount: 0,
      errorCount: 0,
      progress: 0,
      createdAt: savedBatch.createdAt,
    };
  }

  /**
   * Get batch import status/progress.
   */
  async getImportBatchStatus(batchId: string): Promise<ImportBatchResponseDto> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });

    if (!batch) {
      throw new NotFoundException(
        `Không tìm thấy batch import với ID "${batchId}"`,
      );
    }

    return {
      batchId: batch.id,
      status: batch.status,
      entityType: batch.entityType,
      fileName: batch.fileName,
      totalRows: batch.totalRows,
      successCount: batch.successCount,
      errorCount: batch.errorCount,
      progress: batch.progress,
      errors: batch.errors || undefined,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
    };
  }

  /**
   * Synchronous teacher import with conflict strategy support.
   */
  private async importTeachersSync(
    parsedRows: Array<{
      rowNumber: number;
      data: Record<string, unknown>;
      errors: ImportError[];
    }>,
    schoolId: string,
    conflictStrategy: ConflictStrategy,
    file: Express.Multer.File,
    userId?: string,
  ): Promise<ImportResultDto> {
    // Phase 1: Validate ALL rows before any insert (fail-fast)
    const validationErrors: ImportError[] = [];
    const validatedTeachers: Array<{
      rowNumber: number;
      employeeCode: string;
      fullName: string;
      shortName: string | null;
      gradeId: string | null;
      departmentId: string | null;
      jobTitle: string | null;
      managementLevel: string | null;
      gender: Gender | null;
      maxPeriodsPerWeek: number;
      existingTeacher: TeacherEntity | null;
    }> = [];

    // Pre-fetch lookup data to avoid N+1 queries
    const grades = await this.gradeRepo.find({ where: { schoolId } });
    const departments = await this.departmentRepo.find({ where: { schoolId } });
    const gradeMap = new Map(grades.map((g) => [g.name, g.id]));
    const departmentMap = new Map(departments.map((d) => [d.name, d.id]));

    // Track employee codes within this import batch for intra-file duplicate detection
    const seenEmployeeCodes = new Set<string>();

    for (const row of parsedRows) {
      if (row.errors.length > 0) {
        validationErrors.push(...row.errors);
        continue;
      }

      const employeeCode = row.data['employeeCode'] as string;
      if (!employeeCode) {
        validationErrors.push({
          row: row.rowNumber,
          field: 'employeeCode',
          message: 'Trường "Mã NV" là bắt buộc',
          value: '',
        });
        continue;
      }

      // Check intra-file duplicate
      if (seenEmployeeCodes.has(employeeCode)) {
        validationErrors.push({
          row: row.rowNumber,
          field: 'employeeCode',
          message: `Mã nhân viên "${employeeCode}" bị trùng trong file import`,
          value: employeeCode,
        });
        continue;
      }
      seenEmployeeCodes.add(employeeCode);

      // Check duplicate employeeCode in DB
      const existing = await this.teacherRepo.findOne({
        where: { employeeCode, schoolId, deletedAt: IsNull() },
      });

      if (existing && conflictStrategy === ConflictStrategy.STRICT) {
        validationErrors.push({
          row: row.rowNumber,
          field: 'employeeCode',
          message: `Mã nhân viên "${employeeCode}" đã tồn tại trong hệ thống`,
          value: employeeCode,
        });
        continue;
      }

      // Validate grade_id existence
      let gradeId: string | null = null;
      const gradeName = row.data['gradeName'] as string | null;
      if (gradeName) {
        const foundGradeId = gradeMap.get(gradeName);
        if (!foundGradeId) {
          validationErrors.push({
            row: row.rowNumber,
            field: 'gradeName',
            message: `Không tìm thấy khối "${gradeName}" trong danh mục. Vui lòng tạo khối trước khi import.`,
            value: gradeName,
          });
          continue;
        }
        gradeId = foundGradeId;
      }

      // Validate department_id existence
      let departmentId: string | null = null;
      const departmentName = row.data['departmentName'] as string | null;
      if (departmentName) {
        const foundDepartmentId = departmentMap.get(departmentName);
        if (!foundDepartmentId) {
          validationErrors.push({
            row: row.rowNumber,
            field: 'departmentName',
            message: `Không tìm thấy tổ/bộ môn "${departmentName}" trong danh mục. Vui lòng tạo tổ bộ môn trước khi import.`,
            value: departmentName,
          });
          continue;
        }
        departmentId = foundDepartmentId;
      }

      // Parse and validate gender
      let gender: Gender | null = null;
      const genderRaw = row.data['gender'] as string | null;
      if (genderRaw) {
        const genderLower = genderRaw.toLowerCase().trim();
        if (genderLower === 'nam' || genderLower === 'male') {
          gender = Gender.MALE;
        } else if (
          genderLower === 'nữ' ||
          genderLower === 'nu' ||
          genderLower === 'female'
        ) {
          gender = Gender.FEMALE;
        } else if (
          genderLower === 'khác' ||
          genderLower === 'khac' ||
          genderLower === 'other'
        ) {
          gender = Gender.OTHER;
        } else {
          validationErrors.push({
            row: row.rowNumber,
            field: 'gender',
            message: `Giới tính "${genderRaw}" không hợp lệ. Chấp nhận: Nam, Nữ, Khác`,
            value: genderRaw,
          });
          continue;
        }
      }

      // Parse and validate maxPeriodsPerWeek
      const maxPeriodsPerWeekRaw = row.data['maxPeriodsPerWeek'];
      let maxPeriodsPerWeek = 20;
      if (maxPeriodsPerWeekRaw) {
        const parsed = Number(maxPeriodsPerWeekRaw);
        if (isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
          validationErrors.push({
            row: row.rowNumber,
            field: 'maxPeriodsPerWeek',
            message: `Max tiết/tuần "${maxPeriodsPerWeekRaw}" phải là số nguyên dương`,
            value: String(maxPeriodsPerWeekRaw),
          });
          continue;
        }
        maxPeriodsPerWeek = parsed;
      }

      validatedTeachers.push({
        rowNumber: row.rowNumber,
        employeeCode,
        fullName: row.data['fullName'] as string,
        shortName: (row.data['shortName'] as string) || null,
        gradeId,
        departmentId,
        jobTitle: (row.data['jobTitle'] as string) || null,
        managementLevel: (row.data['managementLevel'] as string) || null,
        gender,
        maxPeriodsPerWeek,
        existingTeacher: existing || null,
      });
    }

    // If validation errors exist, return immediately without inserting anything
    if (validationErrors.length > 0) {
      return {
        totalRows: parsedRows.length,
        successCount: 0,
        errorCount: validationErrors.length,
        errors: validationErrors,
      };
    }

    // Phase 2: Insert/Update all validated rows within a single transaction
    let successCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const teacherData of validatedTeachers) {
        if (teacherData.existingTeacher) {
          // Handle upsert or merge for existing records
          if (conflictStrategy === ConflictStrategy.UPSERT) {
            await manager.update(
              TeacherEntity,
              teacherData.existingTeacher.id,
              {
                fullName: teacherData.fullName,
                shortName: teacherData.shortName,
                gradeId: teacherData.gradeId,
                departmentId: teacherData.departmentId,
                jobTitle: teacherData.jobTitle,
                managementLevel: teacherData.managementLevel,
                gender: teacherData.gender,
                maxPeriodsPerWeek: teacherData.maxPeriodsPerWeek,
              },
            );
          } else if (conflictStrategy === ConflictStrategy.MERGE) {
            const updates: Partial<TeacherEntity> = {};
            if (teacherData.fullName) updates.fullName = teacherData.fullName;
            if (teacherData.shortName !== null)
              updates.shortName = teacherData.shortName;
            if (teacherData.gradeId !== null)
              updates.gradeId = teacherData.gradeId;
            if (teacherData.departmentId !== null)
              updates.departmentId = teacherData.departmentId;
            if (teacherData.jobTitle !== null)
              updates.jobTitle = teacherData.jobTitle;
            if (teacherData.managementLevel !== null)
              updates.managementLevel = teacherData.managementLevel;
            if (teacherData.gender !== null)
              updates.gender = teacherData.gender;
            if (teacherData.maxPeriodsPerWeek !== 20)
              updates.maxPeriodsPerWeek = teacherData.maxPeriodsPerWeek;

            if (Object.keys(updates).length > 0) {
              await manager.update(
                TeacherEntity,
                teacherData.existingTeacher.id,
                updates,
              );
            }
          }
        } else {
          // Create new teacher
          const teacher = manager.create(TeacherEntity, {
            schoolId,
            employeeCode: teacherData.employeeCode,
            fullName: teacherData.fullName,
            shortName: teacherData.shortName,
            gradeId: teacherData.gradeId,
            departmentId: teacherData.departmentId,
            jobTitle: teacherData.jobTitle,
            managementLevel: teacherData.managementLevel,
            gender: teacherData.gender,
            maxPeriodsPerWeek: teacherData.maxPeriodsPerWeek,
          });
          await manager.save(teacher);
        }
        successCount++;
      }
    });

    // Record batch for audit
    if (userId) {
      const batch = this.batchRepo.create({
        schoolId,
        entityType: ImportEntityType.TEACHER,
        fileName: file.originalname || 'unknown.xlsx',
        fileSize: file.size,
        totalRows: parsedRows.length,
        successCount,
        errorCount: 0,
        status: ImportBatchStatus.COMPLETED,
        conflictStrategy,
        uploadedByUserId: userId,
        progress: 100,
        startedAt: new Date(),
        completedAt: new Date(),
      });
      await this.batchRepo.save(batch);
    }

    return {
      totalRows: parsedRows.length,
      successCount,
      errorCount: 0,
      errors: [],
    };
  }

  // ─── DEPARTMENT IMPORT ────────────────────────────────────────────────────

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
    const parsedRows = this.importProcessor.parseWorksheet(
      worksheet,
      columnMappings,
    );

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
          const errMsg =
            saveError instanceof Error
              ? saveError.message
              : 'Lỗi không xác định khi lưu';
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

  // ─── SUBJECT IMPORT ─────────────────────────────────────────────────────

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
    const parsedRows = this.importProcessor.parseWorksheet(
      worksheet,
      columnMappings,
    );

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
        const code =
          name
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

  // ─── CLASS IMPORT ───────────────────────────────────────────────────────

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
    const parsedRows = this.importProcessor.parseWorksheet(
      worksheet,
      columnMappings,
    );

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

  // ─── TIMETABLE IMPORT ───────────────────────────────────────────────────

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
    const parsedRows = this.importProcessor.parseWorksheet(
      worksheet,
      columnMappings,
    );

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

  // ─── TEMPLATE GENERATION ─────────────────────────────────────────────────

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
        throw new BadRequestException(
          `Loại template "${type}" không hợp lệ. Chấp nhận: teachers, subjects, classes, timetable, departments`,
        );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────

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
      employeeCode: 'GV001',
      fullName: 'Nguyễn Văn A',
      shortName: 'A',
      gradeName: 'Khối 10',
      departmentName: 'Tổ Toán',
      jobTitle: 'Giáo viên chính',
      managementLevel: 'Tổ trưởng',
      gender: 'Nam',
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

  private buildDepartmentTemplate(
    worksheet: import('exceljs').Worksheet,
  ): void {
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
      '#3b82f6',
      '#ef4444',
      '#10b981',
      '#f59e0b',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
      '#f97316',
      '#6366f1',
      '#14b8a6',
      '#e11d48',
      '#0ea5e9',
      '#a855f7',
      '#22c55e',
      '#eab308',
      '#d946ef',
      '#0891b2',
      '#65a30d',
      '#dc2626',
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
      throw new BadRequestException(
        'File phải có định dạng Excel (.xlsx hoặc .xls)',
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Kích thước file tối đa là 10MB');
    }
  }
}
