import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { DepartmentEntity } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { DuplicateDepartmentNameException } from './exceptions/duplicate-department-name.exception';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class DepartmentService {
  constructor(private readonly departmentRepository: DepartmentRepository) {}

  async findAll(
    query: DepartmentQueryDto,
    schoolScope?: string | null,
  ): Promise<PaginatedResponse<DepartmentEntity>> {
    if (schoolScope) {
      query.schoolId = schoolScope;
    }

    const [data, total] = await this.departmentRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách tổ bộ môn thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Find departments by a specific set of IDs (used for Teacher role filtering).
   * Returns paginated results scoped to the provided department IDs.
   */
  async findAllByIds(
    ids: string[],
    query: DepartmentQueryDto,
    schoolScope?: string | null,
  ): Promise<PaginatedResponse<DepartmentEntity>> {
    if (schoolScope) {
      query.schoolId = schoolScope;
    }

    const [data, total] = await this.departmentRepository.findAllByIds(
      ids,
      query,
    );
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách tổ bộ môn thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<DepartmentEntity> {
    const department = await this.departmentRepository.findById(id);
    if (!department) {
      throw new NotFoundException('Không tìm thấy tổ bộ môn');
    }
    return department;
  }

  async findBySchool(schoolId: string): Promise<DepartmentEntity[]> {
    return this.departmentRepository.findBySchool(schoolId);
  }

  async create(
    dto: CreateDepartmentDto,
    schoolScope?: string | null,
  ): Promise<DepartmentEntity> {
    const schoolId = schoolScope || dto.schoolId;
    if (!schoolId) {
      throw new BadRequestException('schoolId là bắt buộc');
    }
    await this.validateName(dto.name, schoolId);

    return this.departmentRepository.create({
      schoolId,
      name: dto.name.trim(),
      headTeacherId: dto.headTeacherId ?? null,
    });
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentEntity> {
    const department = await this.findById(id);

    if (dto.name !== undefined) {
      await this.validateName(dto.name, department.schoolId, id);
      dto.name = dto.name.trim();
    }

    const updated = await this.departmentRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tổ bộ môn');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);

    const activeMembers =
      await this.departmentRepository.countActiveMembers(id);
    if (activeMembers > 0) {
      throw new BadRequestException(
        'Không thể xóa tổ bộ môn vì còn thành viên',
      );
    }

    await this.departmentRepository.softDelete(id);
  }

  private async validateName(
    name: string,
    schoolId: string,
    excludeId?: string,
  ): Promise<void> {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length > 100) {
      throw new BadRequestException('Tên tổ bộ môn phải từ 1-100 ký tự');
    }

    const existing = await this.departmentRepository.findByNameAndSchool(
      trimmed,
      schoolId,
      excludeId,
    );
    if (existing) {
      throw new DuplicateDepartmentNameException();
    }
  }
}
