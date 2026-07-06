import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Job } from 'bullmq';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { GradeEntity } from '../../class/entities/grade.entity';
import { DepartmentEntity } from '../../department/entities/department.entity';
import {
  ImportBatchEntity,
  ImportBatchStatus,
} from '../entities/import-batch.entity';
import { ImportProcessor } from './import.processor';
import { ImportError } from '../dto/import-result.dto';
import { ConflictStrategy } from '../enums/conflict-strategy.enum';
import { Gender } from '../../../common/enums/status.enum';

export interface TeacherImportJobData {
  batchId: string;
  fileBuffer: string; // base64 encoded
  schoolId: string;
  conflictStrategy: ConflictStrategy;
}

interface ValidatedTeacherRow {
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
}

@Processor('teacher-import')
export class TeacherImportProcessor extends WorkerHost {
  private readonly logger = new Logger(TeacherImportProcessor.name);

  constructor(
    @InjectRepository(ImportBatchEntity)
    private readonly batchRepo: Repository<ImportBatchEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(GradeEntity)
    private readonly gradeRepo: Repository<GradeEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departmentRepo: Repository<DepartmentEntity>,
    private readonly dataSource: DataSource,
    private readonly importProcessor: ImportProcessor,
  ) {
    super();
  }

  async process(job: Job<TeacherImportJobData>): Promise<void> {
    const { batchId, fileBuffer, schoolId, conflictStrategy } = job.data;

    this.logger.log(
      `Bắt đầu xử lý import batch ${batchId}, strategy: ${conflictStrategy}`,
    );

    // Update batch status → processing
    await this.batchRepo.update(batchId, {
      status: ImportBatchStatus.PROCESSING,
      startedAt: new Date(),
    });

    try {
      const buffer = Buffer.from(fileBuffer, 'base64');
      const workbook = await this.importProcessor.parseExcelFile(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        await this.failBatch(batchId, 'File không có sheet dữ liệu');
        return;
      }

      const columnMappings = this.importProcessor.getTeacherColumnMappings();
      const parsedRows = this.importProcessor.parseWorksheet(
        worksheet,
        columnMappings,
      );

      await this.batchRepo.update(batchId, { totalRows: parsedRows.length });
      await job.updateProgress(5);

      // Phase 1: Validate all rows
      const validationErrors: ImportError[] = [];
      const validatedTeachers: ValidatedTeacherRow[] = [];

      // Pre-fetch lookup data
      const grades = await this.gradeRepo.find({ where: { schoolId } });
      const departments = await this.departmentRepo.find({
        where: { schoolId },
      });
      const gradeMap = new Map(grades.map((g) => [g.name, g.id]));
      const departmentMap = new Map(departments.map((d) => [d.name, d.id]));
      const seenEmployeeCodes = new Set<string>();

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];

        if (row.errors.length > 0) {
          validationErrors.push(...row.errors);
          continue;
        }

        const validated = await this.validateRow(
          row,
          schoolId,
          conflictStrategy,
          gradeMap,
          departmentMap,
          seenEmployeeCodes,
          validationErrors,
        );

        if (validated) {
          validatedTeachers.push(validated);
        }

        // Update progress during validation phase (5% - 50%)
        if (i % 50 === 0) {
          const validationProgress =
            5 + Math.round((i / parsedRows.length) * 45);
          await job.updateProgress(validationProgress);
        }
      }

      await job.updateProgress(50);

      // If strict mode and has validation errors, fail fast
      if (
        conflictStrategy === ConflictStrategy.STRICT &&
        validationErrors.length > 0
      ) {
        await this.batchRepo.update(batchId, {
          status: ImportBatchStatus.COMPLETED,
          totalRows: parsedRows.length,
          successCount: 0,
          errorCount: validationErrors.length,
          errors: validationErrors,
          progress: 100,
          completedAt: new Date(),
        });
        await job.updateProgress(100);
        return;
      }

      // Phase 2: Insert/Update within transaction
      let successCount = 0;

      await this.dataSource.transaction(async (manager) => {
        for (let i = 0; i < validatedTeachers.length; i++) {
          const teacherData = validatedTeachers[i];

          if (teacherData.existingTeacher) {
            // Upsert or merge
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
            // Create new
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

          // Update progress during insert phase (50% - 95%)
          if (i % 20 === 0) {
            const insertProgress =
              50 + Math.round((i / validatedTeachers.length) * 45);
            await job.updateProgress(insertProgress);
          }
        }
      });

      // Finalize batch
      await this.batchRepo.update(batchId, {
        status: ImportBatchStatus.COMPLETED,
        successCount,
        errorCount: validationErrors.length,
        errors: validationErrors.length > 0 ? validationErrors : null,
        progress: 100,
        completedAt: new Date(),
      });

      await job.updateProgress(100);
      this.logger.log(
        `Import batch ${batchId} hoàn thành: ${successCount} thành công, ${validationErrors.length} lỗi`,
      );
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      this.logger.error(`Import batch ${batchId} thất bại: ${errMsg}`);
      await this.failBatch(batchId, errMsg);
      throw error;
    }
  }

  private async validateRow(
    row: {
      rowNumber: number;
      data: Record<string, unknown>;
      errors: ImportError[];
    },
    schoolId: string,
    conflictStrategy: ConflictStrategy,
    gradeMap: Map<string, string>,
    departmentMap: Map<string, string>,
    seenEmployeeCodes: Set<string>,
    validationErrors: ImportError[],
  ): Promise<ValidatedTeacherRow | null> {
    const employeeCode = row.data['employeeCode'] as string;
    if (!employeeCode) {
      validationErrors.push({
        row: row.rowNumber,
        field: 'employeeCode',
        message: 'Trường "Mã NV" là bắt buộc',
        value: '',
      });
      return null;
    }

    // Check intra-file duplicate
    if (seenEmployeeCodes.has(employeeCode)) {
      validationErrors.push({
        row: row.rowNumber,
        field: 'employeeCode',
        message: `Mã nhân viên "${employeeCode}" bị trùng trong file import`,
        value: employeeCode,
      });
      return null;
    }
    seenEmployeeCodes.add(employeeCode);

    // Check existence in DB
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
      return null;
    }

    // Validate grade
    let gradeId: string | null = null;
    const gradeName = row.data['gradeName'] as string | null;
    if (gradeName) {
      const foundGradeId = gradeMap.get(gradeName);
      if (!foundGradeId) {
        validationErrors.push({
          row: row.rowNumber,
          field: 'gradeName',
          message: `Không tìm thấy khối "${gradeName}" trong danh mục`,
          value: gradeName,
        });
        return null;
      }
      gradeId = foundGradeId;
    }

    // Validate department
    let departmentId: string | null = null;
    const departmentName = row.data['departmentName'] as string | null;
    if (departmentName) {
      const foundDepartmentId = departmentMap.get(departmentName);
      if (!foundDepartmentId) {
        validationErrors.push({
          row: row.rowNumber,
          field: 'departmentName',
          message: `Không tìm thấy tổ/bộ môn "${departmentName}" trong danh mục`,
          value: departmentName,
        });
        return null;
      }
      departmentId = foundDepartmentId;
    }

    // Parse gender
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
        return null;
      }
    }

    // Parse maxPeriodsPerWeek
    let maxPeriodsPerWeek = 20;
    const maxPeriodsRaw = row.data['maxPeriodsPerWeek'];
    if (maxPeriodsRaw) {
      const parsed = Number(maxPeriodsRaw);
      if (isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        validationErrors.push({
          row: row.rowNumber,
          field: 'maxPeriodsPerWeek',
          message: `Max tiết/tuần "${maxPeriodsRaw}" phải là số nguyên dương`,
          value: String(maxPeriodsRaw),
        });
        return null;
      }
      maxPeriodsPerWeek = parsed;
    }

    return {
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
    };
  }

  private async failBatch(
    batchId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.batchRepo.update(batchId, {
      status: ImportBatchStatus.FAILED,
      errors: [{ row: 0, field: 'system', message: errorMessage }],
      progress: 100,
      completedAt: new Date(),
    });
  }
}
