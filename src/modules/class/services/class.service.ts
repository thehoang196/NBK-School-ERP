import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ClassRepository } from '../repositories/class.repository';
import { ClassEntity } from '../entities/class.entity';
import { CreateClassDto } from '../dto/create-class.dto';
import { UpdateClassDto } from '../dto/update-class.dto';
import { ClassQueryDto } from '../dto/class-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class ClassService {
  constructor(private readonly classRepository: ClassRepository) {}

  async findAll(query: ClassQueryDto): Promise<PaginatedResponse<ClassEntity>> {
    const [data, total] = await this.classRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách lớp thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<ClassEntity> {
    const classEntity = await this.classRepository.findById(id);
    if (!classEntity) {
      throw new NotFoundException('Không tìm thấy lớp');
    }
    return classEntity;
  }

  async create(dto: CreateClassDto): Promise<ClassEntity> {
    const existing = await this.classRepository.findByNameInGradeAndYear(
      dto.gradeId,
      dto.academicYearId,
      dto.name,
    );
    if (existing) {
      throw new BadRequestException('Tên lớp đã tồn tại trong khối và năm học này');
    }
    return this.classRepository.create(dto);
  }

  async update(id: string, dto: UpdateClassDto): Promise<ClassEntity> {
    const classEntity = await this.findById(id);

    if (dto.name) {
      const gradeId = dto.gradeId || classEntity.gradeId;
      const academicYearId = dto.academicYearId || classEntity.academicYearId;
      const existing = await this.classRepository.findByNameInGradeAndYear(
        gradeId,
        academicYearId,
        dto.name,
      );
      if (existing && existing.id !== id) {
        throw new BadRequestException('Tên lớp đã tồn tại trong khối và năm học này');
      }
    }

    const updated = await this.classRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy lớp');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classRepository.softDelete(id);
  }
}
