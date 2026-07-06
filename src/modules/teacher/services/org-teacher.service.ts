import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { TeacherEntity } from '../entities/teacher.entity';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentEntity } from '../../teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentRole } from '../../teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../teacher-school-assignment/enums/assignment-status.enum';
import { OrgTeacherQueryDto } from '../dto/org-teacher-query.dto';
import {
  OrgTeacherResponseDto,
  OrgTeacherDetailDto,
  SchoolAssignmentSummaryDto,
} from '../dto/org-teacher-response.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class OrgTeacherService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly teacherSchoolAssignmentService: TeacherSchoolAssignmentService,
  ) {}

  /**
   * Lấy danh sách giáo viên toàn tổ chức với pagination và filters.
   * SUPER_ADMIN: xem tất cả teachers trong tổ chức.
   * SCHOOL_ADMIN: xem teachers thuộc trường mình + teachers có secondary assignment tại trường mình.
   *
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4
   */
  async findAll(
    query: OrgTeacherQueryDto,
    userSchoolId?: string,
    isSuperAdmin = false,
  ): Promise<PaginatedResponse<OrgTeacherResponseDto>> {
    const {
      page,
      limit,
      schoolId,
      teacherType,
      departmentId,
      hasCrossSchool,
      search,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.dataSource
      .getRepository(TeacherEntity)
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.school', 'school')
      .leftJoinAndSelect('teacher.department', 'department')
      .where('teacher.deletedAt IS NULL');

    // Scope: SCHOOL_ADMIN only sees own school + cross-school teachers assigned to their school
    if (!isSuperAdmin && userSchoolId) {
      qb.andWhere(
        `(teacher.schoolId = :userSchoolId OR EXISTS (
          SELECT 1 FROM teacher_school_assignments tsa
          WHERE tsa.teacher_id = teacher.id
            AND tsa.school_id = :userSchoolId
            AND tsa.status = :activeStatus
            AND tsa.deleted_at IS NULL
        ))`,
        { userSchoolId, activeStatus: AssignmentStatus.ACTIVE },
      );
    }

    // Filter by school
    if (schoolId) {
      qb.andWhere(
        `(teacher.schoolId = :filterSchoolId OR EXISTS (
          SELECT 1 FROM teacher_school_assignments tsa2
          WHERE tsa2.teacher_id = teacher.id
            AND tsa2.school_id = :filterSchoolId
            AND tsa2.status = :activeStatus2
            AND tsa2.deleted_at IS NULL
        ))`,
        { filterSchoolId: schoolId, activeStatus2: AssignmentStatus.ACTIVE },
      );
    }

    // Filter by teacherType
    if (teacherType) {
      qb.andWhere('teacher.teacherType = :teacherType', { teacherType });
    }

    // Filter by departmentId
    if (departmentId) {
      qb.andWhere('teacher.departmentId = :departmentId', { departmentId });
    }

    // Filter by hasCrossSchool
    if (hasCrossSchool === true) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM teacher_school_assignments tsa3
          WHERE tsa3.teacher_id = teacher.id
            AND tsa3.role = :secondaryRole
            AND tsa3.status = :activeStatus3
            AND tsa3.deleted_at IS NULL
        )`,
        {
          secondaryRole: AssignmentRole.SECONDARY,
          activeStatus3: AssignmentStatus.ACTIVE,
        },
      );
    } else if (hasCrossSchool === false) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM teacher_school_assignments tsa4
          WHERE tsa4.teacher_id = teacher.id
            AND tsa4.role = :secondaryRole2
            AND tsa4.status = :activeStatus4
            AND tsa4.deleted_at IS NULL
        )`,
        {
          secondaryRole2: AssignmentRole.SECONDARY,
          activeStatus4: AssignmentStatus.ACTIVE,
        },
      );
    }

    // Search
    if (search) {
      qb.andWhere(
        '(teacher.fullName ILIKE :search OR teacher.employeeCode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Sorting
    const validSortFields = [
      'fullName',
      'employeeCode',
      'teacherType',
      'createdAt',
      'status',
    ];
    if (sortBy && validSortFields.includes(sortBy)) {
      qb.orderBy(`teacher.${sortBy}`, sortOrder);
    } else {
      qb.orderBy('teacher.fullName', 'ASC');
    }

    qb.skip(skip).take(limit);

    const [teachers, total] = await qb.getManyAndCount();

    // Load assignments for each teacher
    const data = await Promise.all(
      teachers.map((teacher) => this.mapToOrgTeacherResponse(teacher)),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách giáo viên tổ chức thành công',
      meta: { page, limit, total, totalPages },
    };
  }

  /**
   * Lấy chi tiết giáo viên với full assignment history.
   * Validates: Requirements 7.1, 7.2
   */
  async findOne(
    teacherId: string,
    userSchoolId?: string,
    isSuperAdmin = false,
  ): Promise<OrgTeacherDetailDto> {
    const teacher = await this.dataSource.getRepository(TeacherEntity).findOne({
      where: { id: teacherId, deletedAt: IsNull() },
      relations: { school: true, department: true },
    });

    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }

    // SCHOOL_ADMIN scope check: teacher must belong to their school or have a cross-school assignment
    if (!isSuperAdmin && userSchoolId) {
      const hasAccess = await this.checkSchoolAdminAccess(
        teacher,
        userSchoolId,
      );
      if (!hasAccess) {
        throw new NotFoundException('Không tìm thấy giáo viên');
      }
    }

    // Get all assignments (including inactive for history)
    const allAssignments =
      await this.teacherSchoolAssignmentService.findByTeacher(
        teacherId,
        true, // include inactive
      );

    const activeAssignments = allAssignments.filter(
      (a) => a.status === AssignmentStatus.ACTIVE,
    );

    const assignments = activeAssignments.map((a) =>
      this.mapAssignmentSummary(a),
    );
    const assignmentHistory = allAssignments.map((a) =>
      this.mapAssignmentSummary(a),
    );

    const hasSecondary = activeAssignments.some(
      (a) => a.role === AssignmentRole.SECONDARY,
    );

    const detail: OrgTeacherDetailDto = {
      id: teacher.id,
      employeeCode: teacher.employeeCode,
      fullName: teacher.fullName,
      shortName: teacher.shortName,
      teacherType: teacher.teacherType,
      status: teacher.status,
      primarySchoolId: teacher.schoolId,
      primarySchoolName: teacher.school?.name ?? null,
      departmentId: teacher.departmentId,
      departmentName: teacher.department?.name ?? null,
      hasCrossSchool: hasSecondary,
      schoolCount: this.countUniqueSchools(teacher, activeAssignments),
      assignments,
      email: teacher.email,
      phone: teacher.phone,
      jobTitle: teacher.jobTitle,
      maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
      minPeriodsPerWeek: teacher.minPeriodsPerWeek,
      maxPeriodsPerDay: teacher.maxPeriodsPerDay,
      assignmentHistory,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
    };

    return detail;
  }

  /**
   * Check if SCHOOL_ADMIN has access to view a teacher
   * (teacher belongs to their school OR has active assignment to their school)
   */
  private async checkSchoolAdminAccess(
    teacher: TeacherEntity,
    userSchoolId: string,
  ): Promise<boolean> {
    // Teacher's primary school matches
    if (teacher.schoolId === userSchoolId) {
      return true;
    }

    // Check for cross-school assignment to admin's school
    const activeAssignments =
      await this.teacherSchoolAssignmentService.findByTeacher(
        teacher.id,
        false,
      );

    return activeAssignments.some(
      (a) =>
        a.schoolId === userSchoolId && a.status === AssignmentStatus.ACTIVE,
    );
  }

  private async mapToOrgTeacherResponse(
    teacher: TeacherEntity,
  ): Promise<OrgTeacherResponseDto> {
    const activeAssignments =
      await this.teacherSchoolAssignmentService.findByTeacher(
        teacher.id,
        false,
      );

    const hasSecondary = activeAssignments.some(
      (a) => a.role === AssignmentRole.SECONDARY,
    );

    const assignments = activeAssignments.map((a) =>
      this.mapAssignmentSummary(a),
    );

    return {
      id: teacher.id,
      employeeCode: teacher.employeeCode,
      fullName: teacher.fullName,
      shortName: teacher.shortName,
      teacherType: teacher.teacherType,
      status: teacher.status,
      primarySchoolId: teacher.schoolId,
      primarySchoolName: teacher.school?.name ?? null,
      departmentId: teacher.departmentId,
      departmentName: teacher.department?.name ?? null,
      hasCrossSchool: hasSecondary,
      schoolCount: this.countUniqueSchools(teacher, activeAssignments),
      assignments,
    };
  }

  private mapAssignmentSummary(
    assignment: TeacherSchoolAssignmentEntity,
  ): SchoolAssignmentSummaryDto {
    return {
      id: assignment.id,
      schoolId: assignment.schoolId,
      schoolName: assignment.school?.name ?? '',
      schoolCode: assignment.school?.code ?? '',
      role: assignment.role,
      status: assignment.status,
      effectiveStartDate: assignment.effectiveStartDate,
      effectiveEndDate: assignment.effectiveEndDate,
    };
  }

  /**
   * Count unique schools a teacher is assigned to (including primary school from teacher.schoolId)
   */
  private countUniqueSchools(
    teacher: TeacherEntity,
    activeAssignments: TeacherSchoolAssignmentEntity[],
  ): number {
    const schoolIds = new Set<string>();
    schoolIds.add(teacher.schoolId); // always include primary
    for (const a of activeAssignments) {
      schoolIds.add(a.schoolId);
    }
    return schoolIds.size;
  }
}
