import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { TeachingAssignmentRepository } from './teaching-assignment.repository';
import { TeachingAssignmentEntity } from './entities/teaching-assignment.entity';
import {
  CreateTeachingAssignmentDto,
  UpdateTeachingAssignmentDto,
  BulkCreateTeachingAssignmentDto,
  CopyPreviousTeachingAssignmentDto,
  TeachingAssignmentQueryDto,
  WorkloadResponseDto,
  WorkloadStatus,
} from './dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { ClassEntity } from '../class/entities/class.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherSubjectService } from '../teacher/teacher-subject.service';
import { TeacherSchoolAssignmentService } from '../teacher-school-assignment/teacher-school-assignment.service';
import { CrossCampusErrors } from '../teacher-school-assignment/errors/cross-campus.errors';

const MISSING_QUALIFICATION_WARNING =
  'Giáo viên chưa được khai báo là có thể dạy môn học này';

/** Response for aggregated workload across all schools */
export interface AggregatedWorkloadResponse {
  totalPeriods: number;
  bySchool: Array<{ schoolId: string; periods: number }>;
  isOverloaded: boolean;
}

@Injectable()
export class TeachingAssignmentService {
  constructor(
    private readonly teachingAssignmentRepository: TeachingAssignmentRepository,
    private readonly dataSource: DataSource,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    private readonly teacherSubjectService: TeacherSubjectService,
    private readonly teacherSchoolAssignmentService: TeacherSchoolAssignmentService,
  ) {}

  async findAll(
    query: TeachingAssignmentQueryDto,
  ): Promise<PaginatedResponse<TeachingAssignmentEntity>> {
    const [data, total] =
      await this.teachingAssignmentRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách phân công giảng dạy thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<TeachingAssignmentEntity> {
    const assignment = await this.teachingAssignmentRepository.findById(id);
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy phân công giảng dạy');
    }
    return assignment;
  }

  async create(
    dto: CreateTeachingAssignmentDto,
  ): Promise<TeachingAssignmentEntity> {
    await this.validateDuplicate(
      dto.semesterId,
      dto.teacherId,
      dto.classId,
      dto.subjectId,
    );

    // Resolve schoolId from the class
    const classEntity = await this.classRepo.findOne({
      where: { id: dto.classId, deletedAt: IsNull() },
    });
    if (!classEntity) {
      throw new BadRequestException('Không tìm thấy lớp học');
    }
    const schoolId = classEntity.schoolId;

    // Validate teacher has active TSA for target school
    const hasAccess =
      await this.teacherSchoolAssignmentService.validateTeacherSchoolAccess(
        dto.teacherId,
        schoolId,
      );
    if (!hasAccess) {
      throw CrossCampusErrors.teacherNoSchoolAssignment();
    }

    return this.teachingAssignmentRepository.create({
      semesterId: dto.semesterId,
      teacherId: dto.teacherId,
      classId: dto.classId,
      subjectId: dto.subjectId,
      schoolId,
      assignmentStatus: 'active',
      periodsPerWeek: dto.periodsPerWeek,
      note: dto.note || null,
    });
  }

  async update(
    id: string,
    dto: UpdateTeachingAssignmentDto,
  ): Promise<TeachingAssignmentEntity> {
    const existing = await this.findById(id);

    const semesterId = existing.semesterId;
    const teacherId = dto.teacherId || existing.teacherId;
    const classId = dto.classId || existing.classId;
    const subjectId = dto.subjectId || existing.subjectId;

    await this.validateDuplicate(semesterId, teacherId, classId, subjectId, id);

    // If classId changed, resolve new schoolId and validate access
    let schoolId: string | undefined;
    if (dto.classId && dto.classId !== existing.classId) {
      const classEntity = await this.classRepo.findOne({
        where: { id: dto.classId, deletedAt: IsNull() },
      });
      if (!classEntity) {
        throw new BadRequestException('Không tìm thấy lớp học');
      }
      schoolId = classEntity.schoolId;

      const hasAccess =
        await this.teacherSchoolAssignmentService.validateTeacherSchoolAccess(
          teacherId,
          schoolId,
        );
      if (!hasAccess) {
        throw CrossCampusErrors.teacherNoSchoolAssignment();
      }
    }

    // If teacherId changed, validate new teacher has access to the school
    if (dto.teacherId && dto.teacherId !== existing.teacherId) {
      const targetSchoolId = schoolId || existing.schoolId;
      const hasAccess =
        await this.teacherSchoolAssignmentService.validateTeacherSchoolAccess(
          dto.teacherId,
          targetSchoolId,
        );
      if (!hasAccess) {
        throw CrossCampusErrors.teacherNoSchoolAssignment();
      }
    }

    const updated = await this.teachingAssignmentRepository.update(id, {
      ...(dto.teacherId && { teacherId: dto.teacherId }),
      ...(dto.classId && { classId: dto.classId }),
      ...(dto.subjectId && { subjectId: dto.subjectId }),
      ...(schoolId && { schoolId }),
      ...(dto.periodsPerWeek !== undefined && {
        periodsPerWeek: dto.periodsPerWeek,
      }),
      ...(dto.note !== undefined && { note: dto.note || null }),
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy phân công giảng dạy');
    }
    return updated;
  }

  /**
   * Trả về cảnh báo (không chặn) khi giáo viên chưa được khai báo là có thể dạy môn học
   * được chỉ định. Dùng bởi Controller để gắn field `warning` vào response sau khi
   * create/update thành công (Requirement 5.1) — không ảnh hưởng đến hành vi create/update.
   */
  async getQualificationWarning(
    teacherId: string,
    subjectId: string,
  ): Promise<string | undefined> {
    const hasQualification = await this.teacherSubjectService.hasAssignment(
      teacherId,
      subjectId,
    );
    return hasQualification ? undefined : MISSING_QUALIFICATION_WARNING;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.teachingAssignmentRepository.softDelete(id);
  }

  async bulkCreate(
    dto: BulkCreateTeachingAssignmentDto,
  ): Promise<TeachingAssignmentEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const results: TeachingAssignmentEntity[] = [];

      for (const item of dto.assignments) {
        const duplicate = await manager.findOne(TeachingAssignmentEntity, {
          where: {
            semesterId: item.semesterId,
            teacherId: item.teacherId,
            classId: item.classId,
            subjectId: item.subjectId,
            deletedAt: IsNull(),
          },
        });

        if (duplicate) {
          throw new ConflictException(
            `Phân công trùng lặp: giáo viên ${item.teacherId} - lớp ${item.classId} - môn ${item.subjectId}`,
          );
        }

        // Resolve schoolId from the class
        const classEntity = await manager.findOne(ClassEntity, {
          where: { id: item.classId, deletedAt: IsNull() },
        });
        if (!classEntity) {
          throw new BadRequestException(
            `Không tìm thấy lớp học ${item.classId}`,
          );
        }

        // Validate teacher has access to school
        const hasAccess =
          await this.teacherSchoolAssignmentService.validateTeacherSchoolAccess(
            item.teacherId,
            classEntity.schoolId,
          );
        if (!hasAccess) {
          throw CrossCampusErrors.teacherNoSchoolAssignment();
        }

        const entity = manager.create(TeachingAssignmentEntity, {
          semesterId: item.semesterId,
          teacherId: item.teacherId,
          classId: item.classId,
          subjectId: item.subjectId,
          schoolId: classEntity.schoolId,
          assignmentStatus: 'active',
          periodsPerWeek: item.periodsPerWeek,
          note: item.note || null,
        });

        const saved = await manager.save(entity);
        results.push(saved);
      }

      return results;
    });
  }

  async copyFromPreviousSemester(
    dto: CopyPreviousTeachingAssignmentDto,
  ): Promise<TeachingAssignmentEntity[]> {
    const sourceAssignments =
      await this.teachingAssignmentRepository.findBySemester(
        dto.sourceSemesterId,
      );

    if (sourceAssignments.length === 0) {
      throw new BadRequestException(
        'Không tìm thấy phân công nào trong học kỳ nguồn',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const results: TeachingAssignmentEntity[] = [];

      for (const source of sourceAssignments) {
        const duplicate = await manager.findOne(TeachingAssignmentEntity, {
          where: {
            semesterId: dto.targetSemesterId,
            teacherId: source.teacherId,
            classId: source.classId,
            subjectId: source.subjectId,
            deletedAt: IsNull(),
          },
        });

        if (duplicate) {
          continue; // Bỏ qua nếu đã tồn tại
        }

        const entity = manager.create(TeachingAssignmentEntity, {
          semesterId: dto.targetSemesterId,
          teacherId: source.teacherId,
          classId: source.classId,
          subjectId: source.subjectId,
          schoolId: source.schoolId,
          assignmentStatus: 'active',
          periodsPerWeek: source.periodsPerWeek,
          note: source.note,
        });

        const saved = await manager.save(entity);
        results.push(saved);
      }

      return results;
    });
  }

  async checkWorkload(
    teacherId: string,
    semesterId: string,
  ): Promise<WorkloadResponseDto> {
    const teacher = await this.teacherRepo.findOne({
      where: { id: teacherId, deletedAt: IsNull() },
    });

    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }

    const totalPeriods =
      await this.teachingAssignmentRepository.sumPeriodsByTeacher(
        teacherId,
        semesterId,
      );

    let workloadStatus: WorkloadStatus;
    if (totalPeriods < teacher.minPeriodsPerWeek) {
      workloadStatus = WorkloadStatus.UNDER;
    } else if (totalPeriods > teacher.maxPeriodsPerWeek) {
      workloadStatus = WorkloadStatus.OVER;
    } else {
      workloadStatus = WorkloadStatus.NORMAL;
    }

    return {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      totalPeriods,
      maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
      minPeriodsPerWeek: teacher.minPeriodsPerWeek,
      workloadStatus,
    };
  }

  async checkAllWorkloads(semesterId: string): Promise<WorkloadResponseDto[]> {
    const teachers = await this.teacherRepo.find({
      where: { deletedAt: IsNull() },
    });

    const results: WorkloadResponseDto[] = [];

    for (const teacher of teachers) {
      const totalPeriods =
        await this.teachingAssignmentRepository.sumPeriodsByTeacher(
          teacher.id,
          semesterId,
        );

      let workloadStatus: WorkloadStatus;
      if (totalPeriods < teacher.minPeriodsPerWeek) {
        workloadStatus = WorkloadStatus.UNDER;
      } else if (totalPeriods > teacher.maxPeriodsPerWeek) {
        workloadStatus = WorkloadStatus.OVER;
      } else {
        workloadStatus = WorkloadStatus.NORMAL;
      }

      results.push({
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        totalPeriods,
        maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
        minPeriodsPerWeek: teacher.minPeriodsPerWeek,
        workloadStatus,
      });
    }

    return results;
  }

  /**
   * Get aggregated workload across all schools for a teacher in a given semester.
   * Sums periodsPerWeek from all active teaching assignments across all schools,
   * groups by school, and compares vs teacher's maxPeriodsPerWeek.
   *
   * Validates: Requirements 4.3, 4.4
   */
  async getAggregatedWorkload(
    teacherId: string,
    semesterId: string,
  ): Promise<AggregatedWorkloadResponse> {
    const teacher = await this.teacherRepo.findOne({
      where: { id: teacherId, deletedAt: IsNull() },
    });

    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }

    // Sum periodsPerWeek grouped by schoolId for active assignments
    const results = await this.teachingAssignmentRepository
      .getRepository()
      .createQueryBuilder('ta')
      .select('ta.school_id', 'schoolId')
      .addSelect('COALESCE(SUM(ta.periods_per_week), 0)', 'periods')
      .where('ta.teacher_id = :teacherId', { teacherId })
      .andWhere('ta.semester_id = :semesterId', { semesterId })
      .andWhere('ta.assignment_status = :status', { status: 'active' })
      .andWhere('ta.deleted_at IS NULL')
      .groupBy('ta.school_id')
      .getRawMany<{ schoolId: string; periods: string }>();

    const bySchool = results.map((row) => ({
      schoolId: row.schoolId,
      periods: parseInt(row.periods, 10),
    }));

    const totalPeriods = bySchool.reduce((sum, item) => sum + item.periods, 0);
    const isOverloaded = totalPeriods > teacher.maxPeriodsPerWeek;

    return {
      totalPeriods,
      bySchool,
      isOverloaded,
    };
  }

  private async validateDuplicate(
    semesterId: string,
    teacherId: string,
    classId: string,
    subjectId: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.teachingAssignmentRepository.checkDuplicate(
      semesterId,
      teacherId,
      classId,
      subjectId,
      excludeId,
    );

    if (duplicate) {
      throw new ConflictException(
        'Phân công giảng dạy đã tồn tại cho giáo viên này với lớp và môn học trong học kỳ',
      );
    }
  }
}
