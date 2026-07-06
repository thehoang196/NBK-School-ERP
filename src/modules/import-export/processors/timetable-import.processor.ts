import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TeacherSchoolAssignmentEntity } from '../../teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentStatus } from '../../teacher-school-assignment/enums/assignment-status.enum';

/**
 * Result of resolving a teacher by employeeCode during timetable import.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
export interface TeacherResolveResult {
  success: boolean;
  teacher?: TeacherEntity;
  error?: {
    code: 'NOT_FOUND' | 'NO_ASSIGNMENT' | 'ASSIGNMENT_INACTIVE';
    message: string;
    suggestion?: string;
  };
}

/**
 * TimetableImportProcessor handles cross-school teacher lookup during timetable import.
 *
 * Enhanced teacher lookup algorithm:
 * 1. Find teacher by employeeCode in importing school → use if found
 * 2. Find teacher by employeeCode across all schools in same Organization
 * 3. If found elsewhere → check active TSA for importing school
 * 4. If TSA exists → use teacher
 * 5. If no TSA → return validation error with suggestion to create assignment
 * 6. If not found anywhere → return "not found" error
 */
@Injectable()
export class TimetableImportProcessor {
  private readonly logger = new Logger(TimetableImportProcessor.name);

  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    @InjectRepository(TeacherSchoolAssignmentEntity)
    private readonly tsaRepo: Repository<TeacherSchoolAssignmentEntity>,
  ) {}

  /**
   * Resolve a teacher by employeeCode for timetable import.
   * Looks up teacher across all schools in the same organization.
   *
   * Algorithm:
   * 1. Find teacher by employeeCode in importing school → use if found
   * 2. Find teacher by employeeCode across all schools in same Organization
   * 3. If found elsewhere → check active TSA for importing school
   * 4. If TSA exists and active → use teacher
   * 5. If TSA exists but inactive → return ASSIGNMENT_INACTIVE error
   * 6. If no TSA → return NO_ASSIGNMENT error with suggestion
   * 7. If not found anywhere → return NOT_FOUND error
   *
   * @param employeeCode - Mã nhân viên giáo viên
   * @param importingSchoolId - ID trường đang import TKB
   * @param organizationId - ID tổ chức (root school)
   * @returns TeacherResolveResult
   *
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   */
  async resolveTeacher(
    employeeCode: string,
    importingSchoolId: string,
    organizationId: string,
  ): Promise<TeacherResolveResult> {
    // Step 1: Find teacher in the importing school first (fastest path)
    const localTeacher = await this.teacherRepo.findOne({
      where: {
        employeeCode,
        schoolId: importingSchoolId,
        deletedAt: IsNull(),
      },
    });

    if (localTeacher) {
      this.logger.debug(
        `Teacher "${employeeCode}" found in importing school ${importingSchoolId}`,
      );
      return { success: true, teacher: localTeacher };
    }

    // Step 2: Find teacher across all schools in the same Organization
    const orgSchoolIds = await this.getOrganizationSchoolIds(organizationId);

    if (orgSchoolIds.length === 0) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Không tìm thấy giáo viên với mã "${employeeCode}" trong tổ chức`,
        },
      };
    }

    const crossSchoolTeacher = await this.teacherRepo.findOne({
      where: {
        employeeCode,
        schoolId: In(orgSchoolIds),
        deletedAt: IsNull(),
      },
      relations: { school: true },
    });

    // Step 6 (in algorithm): Not found anywhere
    if (!crossSchoolTeacher) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Không tìm thấy giáo viên với mã "${employeeCode}" trong bất kỳ trường nào thuộc tổ chức`,
        },
      };
    }

    // Step 3: Found in another school → check TSA for importing school
    this.logger.debug(
      `Teacher "${employeeCode}" found in school "${crossSchoolTeacher.schoolId}", checking TSA for importing school`,
    );

    const tsa = await this.tsaRepo.findOne({
      where: {
        teacherId: crossSchoolTeacher.id,
        schoolId: importingSchoolId,
        deletedAt: IsNull(),
      },
    });

    // Step 4: TSA exists and is active → use teacher
    if (tsa && tsa.status === AssignmentStatus.ACTIVE) {
      this.logger.debug(
        `Teacher "${employeeCode}" has active TSA for importing school — resolved successfully`,
      );
      return { success: true, teacher: crossSchoolTeacher };
    }

    // Step 5 (alt): TSA exists but inactive
    if (tsa && tsa.status === AssignmentStatus.INACTIVE) {
      const schoolName =
        crossSchoolTeacher.school?.name ?? crossSchoolTeacher.schoolId;
      return {
        success: false,
        error: {
          code: 'ASSIGNMENT_INACTIVE',
          message: `Giáo viên "${crossSchoolTeacher.fullName}" (${employeeCode}) thuộc trường "${schoolName}" có phân công liên trường nhưng đã bị vô hiệu hóa`,
          suggestion: `Kích hoạt lại phân công liên trường cho giáo viên "${crossSchoolTeacher.fullName}" tại trường đang import`,
        },
      };
    }

    // Step 5: No TSA → return validation error with suggestion
    const schoolName =
      crossSchoolTeacher.school?.name ?? crossSchoolTeacher.schoolId;
    return {
      success: false,
      error: {
        code: 'NO_ASSIGNMENT',
        message: `Giáo viên "${crossSchoolTeacher.fullName}" (${employeeCode}) thuộc trường "${schoolName}" nhưng chưa có phân công liên trường tại trường đang import`,
        suggestion: `Tạo phân công liên trường (Teacher School Assignment) cho giáo viên "${crossSchoolTeacher.fullName}" tại trường đang import trước khi import TKB`,
      },
    };
  }

  /**
   * Get all school IDs that belong to the same organization.
   * Organization structure:
   * - parentSchoolId = null → the school IS the organization root
   * - parentSchoolId = orgId → the school is a child of the organization
   *
   * @param organizationId - The root organization school ID
   * @returns Array of school IDs in the organization
   */
  private async getOrganizationSchoolIds(
    organizationId: string,
  ): Promise<string[]> {
    // Find all schools belonging to this organization:
    // 1. The organization root itself (id = organizationId)
    // 2. All child schools (parentSchoolId = organizationId)
    const schools = await this.schoolRepo.find({
      where: [
        { id: organizationId, deletedAt: IsNull() },
        { parentSchoolId: organizationId, deletedAt: IsNull() },
      ],
      select: ['id'],
    });

    return schools.map((s) => s.id);
  }
}
