import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DepartmentRepository } from './department.repository';
import { DepartmentMemberRepository } from './department-member.repository';
import { TeacherRepository } from '../teacher/teacher.repository';
import { TeacherSubjectRepository } from '../teacher/teacher-subject.repository';
import { DepartmentEntity } from './entities/department.entity';
import { DepartmentMemberEntity } from './entities/department-member.entity';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { BatchUpdateDto, BatchAction } from './dto/batch-update.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';
import { PositionTitle } from './enums';

@Injectable()
export class DepartmentMemberService {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly memberRepository: DepartmentMemberRepository,
    private readonly teacherRepository: TeacherRepository,
    private readonly teacherSubjectRepository: TeacherSubjectRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Add a teacher as member to a department.
   * - Validates department exists and belongs to school scope
   * - Validates teacher exists and belongs to same school as department
   * - Checks for duplicate active membership
   * - Creates member with positionTitle = GVBM, managementLevel = null
   */
  async addMember(
    departmentId: string,
    dto: AddMemberDto,
    schoolScope: string | null,
  ): Promise<DepartmentMemberEntity> {
    const department = await this.validateDepartmentScope(
      departmentId,
      schoolScope,
    );

    // Validate teacher exists and belongs to same school
    const teacher = await this.teacherRepository.findByIdInternal(
      dto.teacherId,
    );
    if (!teacher || teacher.schoolId !== department.schoolId) {
      throw new BadRequestException(
        'Giáo viên không tồn tại hoặc không thuộc trường này',
      );
    }

    // Check duplicate active membership
    const existingMember =
      await this.memberRepository.findByTeacherAndDepartment(
        dto.teacherId,
        departmentId,
      );
    if (existingMember) {
      throw new ConflictException(
        'Giáo viên đã là thành viên của tổ bộ môn này',
      );
    }

    // Create member with default values
    return this.memberRepository.create({
      departmentId,
      teacherId: dto.teacherId,
      positionTitle: PositionTitle.GVBM,
      managementLevel: null,
    });
  }

  /**
   * Remove a member from a department (soft delete).
   * - Validates department belongs to school scope
   * - Validates member exists and belongs to department
   */
  async removeMember(
    departmentId: string,
    memberId: string,
    schoolScope: string | null,
  ): Promise<void> {
    await this.validateDepartmentScope(departmentId, schoolScope);

    const member = await this.memberRepository.findById(memberId);
    if (!member || member.departmentId !== departmentId) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    await this.memberRepository.softDelete(memberId);
  }

  /**
   * List active members of a department with pagination.
   * - Validates department belongs to school scope
   * - Returns paginated list of active members with teacher details and subjects
   */
  async listMembers(
    departmentId: string,
    query: MemberQueryDto,
    schoolScope: string | null,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    await this.validateDepartmentScope(departmentId, schoolScope);

    const [members, total] = await this.memberRepository.findByDepartment(
      departmentId,
      query,
    );
    const totalPages = Math.ceil(total / query.limit);

    // Enrich members with their taught subjects
    const teacherIds = members.map((m) => m.teacherId);
    const teacherSubjects =
      await this.teacherSubjectRepository.findByTeacherIds(teacherIds);

    // Group subjects by teacherId
    const subjectsByTeacher = new Map<string, { id: string; name: string }[]>();
    for (const ts of teacherSubjects) {
      const existing = subjectsByTeacher.get(ts.teacherId) || [];
      if (ts.subject) {
        existing.push({ id: ts.subject.id, name: ts.subject.name });
      }
      subjectsByTeacher.set(ts.teacherId, existing);
    }

    const data = members.map((m) => ({
      id: m.id,
      departmentId: m.departmentId,
      teacherId: m.teacherId,
      positionTitle: m.positionTitle,
      managementLevel: m.managementLevel,
      teacher: m.teacher
        ? {
            id: m.teacher.id,
            fullName: m.teacher.fullName,
            shortName: m.teacher.shortName,
            email: m.teacher.email,
          }
        : null,
      subjects: subjectsByTeacher.get(m.teacherId) || [],
    }));

    return {
      success: true,
      data,
      message: 'Lấy danh sách thành viên thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Update the position title of a department member.
   * - Validates department belongs to school scope
   * - Validates member exists and belongs to department
   * - Updates position_title and returns updated record
   */
  async updatePositionTitle(
    departmentId: string,
    memberId: string,
    dto: UpdatePositionDto,
    schoolScope: string | null,
  ): Promise<DepartmentMemberEntity> {
    await this.validateDepartmentScope(departmentId, schoolScope);
    await this.validateMember(memberId, departmentId);
    const updated = await this.memberRepository.updatePositionTitle(
      memberId,
      dto.positionTitle,
    );
    if (!updated) throw new NotFoundException('Không tìm thấy thành viên');
    return updated;
  }

  /**
   * Update the management level of a department member.
   * - Validates department belongs to school scope
   * - Validates member exists and belongs to department
   * - Updates management_level (allows null to clear level) and returns updated record
   */
  async updateManagementLevel(
    departmentId: string,
    memberId: string,
    dto: UpdateLevelDto,
    schoolScope: string | null,
  ): Promise<DepartmentMemberEntity> {
    await this.validateDepartmentScope(departmentId, schoolScope);
    await this.validateMember(memberId, departmentId);
    const updated = await this.memberRepository.updateManagementLevel(
      memberId,
      dto.managementLevel,
    );
    if (!updated) throw new NotFoundException('Không tìm thấy thành viên');
    return updated;
  }

  /**
   * Validate that a member exists and belongs to the given department.
   * Throws NotFoundException if member not found or belongs to a different department.
   */
  private async validateMember(
    memberId: string,
    departmentId: string,
  ): Promise<DepartmentMemberEntity> {
    const member = await this.memberRepository.findById(memberId);
    if (!member || member.departmentId !== departmentId) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    return member;
  }

  /**
   * Batch update department members.
   * - Validates batch size ≤ 50
   * - Validates department belongs to school scope
   * - Validates ALL operations before executing (collect errors by index)
   * - If any validation error → reject entire batch, return errors array
   * - If all pass → execute in single transaction
   * - Return complete list of active members after batch
   */
  async batchUpdate(
    departmentId: string,
    dto: BatchUpdateDto,
    schoolScope: string | null,
  ): Promise<DepartmentMemberEntity[]> {
    // Validate batch size
    if (dto.operations.length > 50) {
      throw new BadRequestException(
        'Số lượng thao tác vượt quá giới hạn tối đa (50)',
      );
    }

    const department = await this.validateDepartmentScope(
      departmentId,
      schoolScope,
    );

    // Phase 1: Validate all operations
    const errors: { index: number; action: string; message: string }[] = [];

    for (let i = 0; i < dto.operations.length; i++) {
      const op = dto.operations[i];
      switch (op.action) {
        case BatchAction.ADD: {
          if (!op.teacherId) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Thiếu teacherId cho thao tác thêm thành viên',
            });
            break;
          }
          const teacher = await this.teacherRepository.findByIdInternal(
            op.teacherId,
          );
          if (!teacher || teacher.schoolId !== department.schoolId) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Giáo viên không tồn tại hoặc không thuộc trường này',
            });
            break;
          }
          const existing =
            await this.memberRepository.findByTeacherAndDepartment(
              op.teacherId,
              departmentId,
            );
          if (existing) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Giáo viên đã là thành viên của tổ bộ môn này',
            });
          }
          break;
        }
        case BatchAction.REMOVE: {
          if (!op.memberId) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Thiếu memberId cho thao tác xóa thành viên',
            });
            break;
          }
          const memberToRemove = await this.memberRepository.findById(
            op.memberId,
          );
          if (!memberToRemove || memberToRemove.departmentId !== departmentId) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Không tìm thấy thành viên',
            });
          }
          break;
        }
        case BatchAction.UPDATE_POSITION: {
          if (!op.memberId) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Thiếu memberId cho thao tác cập nhật chức danh',
            });
            break;
          }
          const memberToUpdatePos = await this.memberRepository.findById(
            op.memberId,
          );
          if (
            !memberToUpdatePos ||
            memberToUpdatePos.departmentId !== departmentId
          ) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Không tìm thấy thành viên',
            });
            break;
          }
          if (!op.positionTitle) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Thiếu positionTitle cho thao tác cập nhật chức danh',
            });
          }
          break;
        }
        case BatchAction.UPDATE_LEVEL: {
          if (!op.memberId) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Thiếu memberId cho thao tác cập nhật cấp bậc',
            });
            break;
          }
          const memberToUpdateLvl = await this.memberRepository.findById(
            op.memberId,
          );
          if (
            !memberToUpdateLvl ||
            memberToUpdateLvl.departmentId !== departmentId
          ) {
            errors.push({
              index: i,
              action: op.action,
              message: 'Không tìm thấy thành viên',
            });
          }
          break;
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Batch validation failed',
        errors,
      });
    }

    // Phase 2: Execute in transaction
    await this.dataSource.transaction(async (manager) => {
      for (const op of dto.operations) {
        switch (op.action) {
          case BatchAction.ADD: {
            const newMember = manager.create(DepartmentMemberEntity, {
              departmentId,
              teacherId: op.teacherId,
              positionTitle: PositionTitle.GVBM,
              managementLevel: null,
            });
            await manager.save(DepartmentMemberEntity, newMember);
            break;
          }
          case BatchAction.REMOVE: {
            await manager.softDelete(DepartmentMemberEntity, op.memberId!);
            break;
          }
          case BatchAction.UPDATE_POSITION: {
            await manager.update(DepartmentMemberEntity, op.memberId!, {
              positionTitle: op.positionTitle,
            });
            break;
          }
          case BatchAction.UPDATE_LEVEL: {
            await manager.update(DepartmentMemberEntity, op.memberId!, {
              managementLevel: op.managementLevel ?? null,
            });
            break;
          }
        }
      }
    });

    // Return current active members
    const [members] = await this.memberRepository.findByDepartment(
      departmentId,
      {
        page: 1,
        limit: 100,
        sortOrder: 'ASC',
      } as MemberQueryDto,
    );
    return members;
  }

  /**
   * Validate that a department exists and belongs to the given school scope.
   * If schoolScope is not null, verify department.schoolId === schoolScope.
   * If not, throw NotFoundException to hide resource existence (requirement 7.2).
   */
  private async validateDepartmentScope(
    departmentId: string,
    schoolScope: string | null,
  ): Promise<DepartmentEntity> {
    const department = await this.departmentRepository.findById(departmentId);
    if (!department) {
      throw new NotFoundException('Không tìm thấy tổ bộ môn');
    }

    if (schoolScope && department.schoolId !== schoolScope) {
      throw new NotFoundException('Không tìm thấy tổ bộ môn');
    }

    return department;
  }
}
