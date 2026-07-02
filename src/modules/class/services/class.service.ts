import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClassRepository } from '../repositories/class.repository';
import { ClassEntity } from '../entities/class.entity';
import { CreateClassDto } from '../dto/create-class.dto';
import { UpdateClassDto } from '../dto/update-class.dto';
import { ClassQueryDto } from '../dto/class-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { AcademicYearEntity } from '../../academic/entities/academic-year.entity';

@Injectable()
export class ClassService {
  constructor(
    private readonly classRepository: ClassRepository,
    @InjectRepository(AcademicYearEntity)
    private readonly academicYearRepo: Repository<AcademicYearEntity>,
  ) {}

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
    let academicYearId = dto.academicYearId;

    if (!academicYearId) {
      const currentYear = await this.academicYearRepo.findOne({
        where: { schoolId: dto.schoolId, isCurrent: true, deletedAt: IsNull() },
      });
      if (!currentYear) {
        throw new BadRequestException('Không tìm thấy năm học hiện tại. Vui lòng thiết lập năm học trước.');
      }
      academicYearId = currentYear.id;
    }

    const existing = await this.classRepository.findByNameInGradeAndYear(
      dto.gradeId,
      academicYearId,
      dto.name,
    );
    if (existing) {
      throw new BadRequestException('Tên lớp đã tồn tại trong khối và năm học này');
    }
    return this.classRepository.create({ ...dto, academicYearId });
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
