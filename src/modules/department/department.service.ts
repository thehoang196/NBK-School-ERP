import { Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { DepartmentEntity } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class DepartmentService {
  constructor(private readonly departmentRepository: DepartmentRepository) {}

  async findAll(query: DepartmentQueryDto): Promise<PaginatedResponse<DepartmentEntity>> {
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

  async create(dto: CreateDepartmentDto): Promise<DepartmentEntity> {
    return this.departmentRepository.create({
      schoolId: dto.schoolId,
      name: dto.name,
      headTeacherId: dto.headTeacherId ?? null,
    });
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentEntity> {
    await this.findById(id);
    const updated = await this.departmentRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tổ bộ môn');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.departmentRepository.softDelete(id);
  }
}
