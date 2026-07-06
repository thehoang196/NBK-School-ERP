import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { TeacherSchoolAssignmentRepository } from './teacher-school-assignment.repository';
import { TeacherSchoolAssignmentEntity } from './entities/teacher-school-assignment.entity';
import { CreateTeacherSchoolAssignmentDto } from './dto/create-teacher-school-assignment.dto';
import { AssignmentRole } from './enums/assignment-role.enum';
import { AssignmentStatus } from './enums/assignment-status.enum';
import { CrossCampusErrors } from './errors/cross-campus.errors';
import { SchoolRepository } from '../school/school.repository';
import { SchoolEntity } from '../school/entities/school.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';

/** Maximum number of secondary school assignments per teacher */
const MAX_SECONDARY_ASSIGNMENTS = 5;

/**
 * Interface for FeatureFlagService (will be injected when available).
 * Uses interface to avoid circular dependency.
 */
export interface IFeatureFlagService {
  isCrossSchoolEnabled(organizationId: string): Promise<boolean>;
}

/**
 * Interface for TokenInvalidationService (will be injected when available).
 */
export interface ITokenInvalidationService {
  invalidateUserTokens(userId: string): Promise<void>;
}

export const FEATURE_FLAG_SERVICE = 'FEATURE_FLAG_SERVICE';
export const TOKEN_INVALIDATION_SERVICE = 'TOKEN_INVALIDATION_SERVICE';

@Injectable()
export class TeacherSchoolAssignmentService {
  private readonly logger = new Logger(TeacherSchoolAssignmentService.name);

  constructor(
    private readonly assignmentRepository: TeacherSchoolAssignmentRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(FEATURE_FLAG_SERVICE)
    private readonly featureFlagService: IFeatureFlagService | null,
    @Optional()
    @Inject(TOKEN_INVALIDATION_SERVICE)
    private readonly tokenInvalidationService: ITokenInvalidationService | null,
  ) {}

  /**
   * Tạo cross-school assignment mới.
   * Validates: Requirements 1.1, 1.3, 1.4, 1.6, 8.5
   *
   * Business rules (in order):
   * 1. Validate same organization
   * 2. Check feature flag enabled
   * 3. Check duplicate assignment
   * 4. Check max 5 secondary assignments
   * 5. Create in transaction
   */
  async createAssignment(
    dto: CreateTeacherSchoolAssignmentDto,
  ): Promise<TeacherSchoolAssignmentEntity> {
    const {
      teacherId,
      schoolId,
      role,
      effectiveStartDate,
      effectiveEndDate,
      note,
    } = dto;

    // Step 1: Get teacher to find their primary school
    const teacher = await this.dataSource.getRepository(TeacherEntity).findOne({
      where: { id: teacherId, deletedAt: IsNull() },
    });
    if (!teacher) {
      throw CrossCampusErrors.teacherNoSchoolAssignment();
    }

    // Step 2: Validate same organization
    const targetSchool = await this.schoolRepository.findById(schoolId);
    if (!targetSchool) {
      throw CrossCampusErrors.crossOrgNotAllowed();
    }

    const primarySchool = await this.schoolRepository.findById(
      teacher.schoolId,
    );
    if (!primarySchool) {
      throw CrossCampusErrors.crossOrgNotAllowed();
    }

    const sameOrg = await this.validateSameOrganization(
      teacher.schoolId,
      schoolId,
    );
    if (!sameOrg) {
      throw CrossCampusErrors.crossOrgNotAllowed();
    }

    // Step 3: Check feature flag
    const organizationId = this.getOrganizationId(primarySchool);
    if (this.featureFlagService) {
      const enabled =
        await this.featureFlagService.isCrossSchoolEnabled(organizationId);
      if (!enabled) {
        throw CrossCampusErrors.featureNotEnabled();
      }
    }

    // Step 4: Check duplicate
    const existing = await this.assignmentRepository.findByTeacherAndSchool(
      teacherId,
      schoolId,
    );
    if (existing) {
      throw CrossCampusErrors.duplicateSchoolAssignment();
    }

    // Step 5: Check max secondary assignments
    if (role === AssignmentRole.SECONDARY) {
      const count = await this.countSecondaryAssignments(teacherId);
      if (count >= MAX_SECONDARY_ASSIGNMENTS) {
        throw CrossCampusErrors.maxSecondaryExceeded();
      }
    }

    // Step 6: Create in transaction
    return this.dataSource.transaction(async (manager) => {
      const entity = manager.create(TeacherSchoolAssignmentEntity, {
        teacherId,
        schoolId,
        role,
        status: AssignmentStatus.ACTIVE,
        effectiveStartDate,
        effectiveEndDate: effectiveEndDate ?? null,
        note: note ?? null,
      });
      return manager.save(TeacherSchoolAssignmentEntity, entity);
    });
  }

  /**
   * Deactivate assignment (soft-delete + flag teaching assignments).
   * Validates: Requirements 1.4, 1.5, 4.5
   *
   * Business rules:
   * 1. Validate not primary assignment
   * 2. Soft-delete the assignment
   * 3. Flag teaching assignments as 'pending_reassignment'
   * 4. Invalidate user token
   */
  async deactivateAssignment(assignmentId: string): Promise<void> {
    // Find the assignment
    const assignment = await this.dataSource
      .getRepository(TeacherSchoolAssignmentEntity)
      .findOne({
        where: { id: assignmentId, deletedAt: IsNull() },
        relations: { teacher: true },
      });

    if (!assignment) {
      throw CrossCampusErrors.teacherNoSchoolAssignment();
    }

    // Step 1: Cannot deactivate primary assignment
    if (assignment.role === AssignmentRole.PRIMARY) {
      throw CrossCampusErrors.primaryAssignmentRequired();
    }

    // Step 2 & 3: Soft-delete and flag teaching assignments in transaction
    await this.dataSource.transaction(async (manager) => {
      // Soft-delete the school assignment
      await manager.softDelete(TeacherSchoolAssignmentEntity, assignmentId);

      // Flag related teaching assignments as 'pending_reassignment'
      // The assignment_status column exists in teaching_assignments table (from migration 174930001000)
      await manager.query(
        `UPDATE "teaching_assignments"
         SET "assignment_status" = 'pending_reassignment', "updated_at" = NOW()
         WHERE "teacher_id" = $1
           AND "deleted_at" IS NULL
           AND EXISTS (
             SELECT 1 FROM "classes" c
             WHERE c."id" = "teaching_assignments"."class_id"
               AND c."school_id" = $2
           )`,
        [assignment.teacherId, assignment.schoolId],
      );
    });

    // Step 4: Invalidate user's token (outside transaction, non-blocking)
    if (this.tokenInvalidationService && assignment.teacher) {
      try {
        // Find associated userId from teacher
        // For now, invalidate using teacherId — the TokenInvalidationService
        // will resolve the userId internally
        await this.tokenInvalidationService.invalidateUserTokens(
          assignment.teacherId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate token for teacher ${assignment.teacherId}: ${error}`,
        );
      }
    }
  }

  /**
   * Lấy danh sách accessible school IDs cho teacher.
   * Validates: Requirements 2.1, 8.2
   *
   * Returns primary school + all active secondary school IDs.
   * Falls back to teacher.schoolId if no assignment records exist.
   */
  async getAccessibleSchoolIds(teacherId: string): Promise<string[]> {
    const activeAssignments =
      await this.assignmentRepository.findActiveByTeacher(teacherId);

    if (activeAssignments.length === 0) {
      // Fallback: use teacher.schoolId for backward compatibility
      const teacher = await this.dataSource
        .getRepository(TeacherEntity)
        .findOne({
          where: { id: teacherId, deletedAt: IsNull() },
        });
      if (teacher) {
        return [teacher.schoolId];
      }
      return [];
    }

    return activeAssignments.map((a) => a.schoolId);
  }

  /**
   * Validate teacher có quyền dạy tại school.
   * Validates: Requirements 1.3
   *
   * Returns true if teacher has an active assignment for the school,
   * or if the school is the teacher's primary school (teacher.schoolId).
   */
  async validateTeacherSchoolAccess(
    teacherId: string,
    schoolId: string,
  ): Promise<boolean> {
    // Check if there's an active assignment
    const assignment = await this.assignmentRepository.findByTeacherAndSchool(
      teacherId,
      schoolId,
    );
    if (assignment && assignment.status === AssignmentStatus.ACTIVE) {
      return true;
    }

    // Fallback: check if schoolId is the teacher's primary school
    const teacher = await this.dataSource.getRepository(TeacherEntity).findOne({
      where: { id: teacherId, deletedAt: IsNull() },
    });
    if (teacher && teacher.schoolId === schoolId) {
      return true;
    }

    return false;
  }

  /**
   * Validate both schools thuộc cùng organization.
   * Validates: Requirements 1.3, 1.4
   *
   * Two schools belong to the same organization if:
   * - They share the same parentSchoolId, OR
   * - One is the parent of the other (parentSchoolId is null and is the other's parent)
   */
  async validateSameOrganization(
    schoolId1: string,
    schoolId2: string,
  ): Promise<boolean> {
    if (schoolId1 === schoolId2) {
      return true;
    }

    const school1 = await this.schoolRepository.findById(schoolId1);
    const school2 = await this.schoolRepository.findById(schoolId2);

    if (!school1 || !school2) {
      return false;
    }

    const orgId1 = this.getOrganizationId(school1);
    const orgId2 = this.getOrganizationId(school2);

    return orgId1 === orgId2;
  }

  /**
   * Count active secondary assignments cho teacher.
   * Validates: Requirements 1.6
   */
  async countSecondaryAssignments(teacherId: string): Promise<number> {
    return this.assignmentRepository.countSecondaryByTeacher(teacherId);
  }

  /**
   * Get all assignments of a teacher.
   * Validates: Requirements 1.1, 1.5
   *
   * @param teacherId - Teacher UUID
   * @param includeInactive - If true, includes inactive/deleted assignments
   */
  async findByTeacher(
    teacherId: string,
    includeInactive = false,
  ): Promise<TeacherSchoolAssignmentEntity[]> {
    if (includeInactive) {
      return this.assignmentRepository.findByTeacher(teacherId);
    }
    return this.assignmentRepository.findActiveByTeacher(teacherId);
  }

  /**
   * Get all assignments for a specific school.
   * Validates: Requirements 1.1, 1.5
   *
   * @param schoolId - School UUID
   */
  async findBySchool(
    schoolId: string,
  ): Promise<TeacherSchoolAssignmentEntity[]> {
    return this.assignmentRepository.findBySchool(schoolId);
  }

  /**
   * Get the organization ID from a school entity.
   * The organization is the root school (parentSchoolId === null).
   * If a school IS the org (parentSchoolId is null), its own ID is the org ID.
   * Otherwise, the parentSchoolId is the org ID.
   */
  private getOrganizationId(school: SchoolEntity): string {
    return school.parentSchoolId ?? school.id;
  }
}
