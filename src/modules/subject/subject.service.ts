import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SubjectRepository } from './subject.repository';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectGradeEntity } from './entities/subject-grade.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectQueryDto } from './dto/subject-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

export interface AssignSubjectGradeDto {
  subjectId: string;
  gradeId: string;
  periodsPerWeek: number;
}

@Injectable()
export class SubjectService {
  constructor(
    private readonly subjectRepository: SubjectRepository,
    @InjectRepository(SubjectGradeEntity)
    private readonly subjectGradeRepo: Repository<SubjectGradeEntity>,
  ) {}

  async findAll(query: SubjectQueryDto): Promise<PaginatedResponse<SubjectEntity>> {
    const [data, total] = await this.subjectRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách môn học thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<SubjectEntity> {
    const subject = await this.subjectRepository.findById(id);
    if (!subject) {
      throw new NotFoundException('Không tìm thấy môn học');
    }
    return subject;
  }

  async create(dto: CreateSubjectDto): Promise<SubjectEntity> {
    const existing = await this.subjectRepository.findByCode(dto.schoolId, dto.code);
    if (existing) {
      throw new BadRequestException('Mã môn học đã tồn tại trong trường này');
    }
    return this.subjectRepository.create(dto);
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectEntity> {
    const subject = await this.findById(id);

    if (dto.code) {
      const existing = await this.subjectRepository.findByCode(subject.schoolId, dto.code);
      if (existing && existing.id !== id) {
        throw new BadRequestException('Mã môn học đã tồn tại trong trường này');
      }
    }

    const updated = await this.subjectRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy môn học');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.subjectRepository.softDelete(id);
  }

  async assignPeriodsPerGrade(dto: AssignSubjectGradeDto): Promise<SubjectGradeEntity> {
    const subject = await this.subjectRepository.findById(dto.subjectId);
    if (!subject) {
      throw new NotFoundException('Không tìm thấy môn học');
    }

    // Check if assignment already exists
    const existing = await this.subjectGradeRepo.findOne({
      where: {
        subjectId: dto.subjectId,
        gradeId: dto.gradeId,
        deletedAt: IsNull(),
      },
    });

    if (existing) {
      // Update existing
      existing.periodsPerWeek = dto.periodsPerWeek;
      return this.subjectGradeRepo.save(existing);
    }

    // Create new
    const entity = this.subjectGradeRepo.create({
      subjectId: dto.subjectId,
      gradeId: dto.gradeId,
      periodsPerWeek: dto.periodsPerWeek,
    });
    return this.subjectGradeRepo.save(entity);
  }

  async getSubjectGrades(subjectId: string): Promise<SubjectGradeEntity[]> {
    return this.subjectGradeRepo.find({
      where: { subjectId, deletedAt: IsNull() },
      relations: { grade: true },
      order: { grade: { level: 'ASC' } },
    });
  }

  async removeSubjectGrade(subjectId: string, gradeId: string): Promise<void> {
    const existing = await this.subjectGradeRepo.findOne({
      where: { subjectId, gradeId, deletedAt: IsNull() },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy phân bổ số tiết theo khối');
    }
    await this.subjectGradeRepo.softDelete(existing.id);
  }
}
