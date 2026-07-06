import { Injectable, NotFoundException } from '@nestjs/common';
import { GradeRepository } from '../repositories/grade.repository';
import { GradeEntity } from '../entities/grade.entity';
import { CreateGradeDto } from '../dto/create-grade.dto';
import { UpdateGradeDto } from '../dto/update-grade.dto';
import { GradeQueryDto } from '../dto/grade-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class GradeService {
  constructor(private readonly gradeRepository: GradeRepository) {}

  async findAll(
    schoolId: string,
    query: GradeQueryDto,
  ): Promise<PaginatedResponse<GradeEntity>> {
    const [data, total] = await this.gradeRepository.findAll(schoolId, query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách khối thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string, schoolId: string): Promise<GradeEntity> {
    const grade = await this.gradeRepository.findById(id, schoolId);
    if (!grade) {
      throw new NotFoundException('Không tìm thấy khối');
    }
    return grade;
  }

  async create(dto: CreateGradeDto, schoolId: string): Promise<GradeEntity> {
    return this.gradeRepository.create({
      ...dto,
      schoolId,
    });
  }

  async update(
    id: string,
    schoolId: string,
    dto: UpdateGradeDto,
  ): Promise<GradeEntity> {
    await this.findById(id, schoolId);
    const updated = await this.gradeRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy khối');
    }
    return updated;
  }

  async remove(id: string, schoolId: string): Promise<void> {
    await this.findById(id, schoolId);
    await this.gradeRepository.softDelete(id);
  }
}
