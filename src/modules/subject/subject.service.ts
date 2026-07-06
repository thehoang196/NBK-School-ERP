import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { SubjectRepository } from './subject.repository';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectGradeEntity } from './entities/subject-grade.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectQueryDto } from './dto/subject-query.dto';
import { DuplicateSubjectCodeException } from './exceptions/duplicate-subject-code.exception';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

export interface SubjectGradeInput {
  gradeId: string;
  periodsPerWeek: number;
}

export interface CreateSubjectWithGradesDto extends CreateSubjectDto {
  subjectGrades?: SubjectGradeInput[];
}

@Injectable()
export class SubjectService {
  constructor(
    private readonly subjectRepository: SubjectRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lấy danh sách môn học có phân trang, lọc theo schoolId
   */
  async findAll(
    query: SubjectQueryDto,
  ): Promise<PaginatedResponse<SubjectEntity>> {
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

  /**
   * Tìm môn học theo ID
   */
  async findById(id: string, schoolId?: string): Promise<SubjectEntity> {
    const subject = await this.subjectRepository.findById(id);
    if (!subject) {
      throw new NotFoundException('Không tìm thấy môn học');
    }
    if (schoolId && subject.schoolId !== schoolId) {
      throw new NotFoundException('Không tìm thấy môn học');
    }
    return subject;
  }

  /**
   * Tạo môn học mới với transaction (subject + subject_grades)
   * Validates unique code within school trước khi tạo
   */
  async create(dto: CreateSubjectWithGradesDto): Promise<SubjectEntity> {
    // Validate unique code within school
    await this.validateUniqueCode(dto.schoolId, dto.code);

    // Auto-generate color nếu chưa có
    if (!dto.colorCode) {
      const count = await this.subjectRepository.countBySchool(dto.schoolId);
      dto.colorCode = this.generateColor(count);
    }

    const { subjectGrades, ...subjectData } = dto;

    // Transaction cho tạo subject + subject_grades
    return this.dataSource.transaction(async (manager) => {
      // Tạo subject
      const subjectRepo = manager.getRepository(SubjectEntity);
      const subjectEntity = subjectRepo.create(subjectData);
      const savedSubject = await subjectRepo.save(subjectEntity);

      // Tạo subject_grades nếu có
      if (subjectGrades && subjectGrades.length > 0) {
        const subjectGradeRepo = manager.getRepository(SubjectGradeEntity);
        const gradeEntities = subjectGrades.map((sg) =>
          subjectGradeRepo.create({
            subjectId: savedSubject.id,
            gradeId: sg.gradeId,
            periodsPerWeek: sg.periodsPerWeek,
          }),
        );
        await subjectGradeRepo.save(gradeEntities);
      }

      return savedSubject;
    });
  }

  /**
   * Cập nhật môn học
   * Validates unique code within school nếu code thay đổi
   */
  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectEntity> {
    const subject = await this.findById(id);

    // Validate unique code nếu code thay đổi
    if (dto.code && dto.code !== subject.code) {
      await this.validateUniqueCode(subject.schoolId, dto.code, id);
    }

    const updated = await this.subjectRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy môn học');
    }
    return updated;
  }

  /**
   * Soft delete môn học
   */
  async softDelete(id: string, schoolId?: string): Promise<void> {
    await this.findById(id, schoolId);
    await this.subjectRepository.softDelete(id);
  }

  /**
   * Gán số tiết/tuần theo khối cho một môn (upsert)
   * REQ-9.2: Cho phép gán số tiết/tuần khác nhau cho mỗi khối
   */
  async upsertSubjectGrade(
    subjectId: string,
    gradeId: string,
    periodsPerWeek: number,
  ): Promise<SubjectGradeEntity> {
    // Validate subject tồn tại
    await this.findById(subjectId);
    return this.subjectRepository.upsertSubjectGrade(
      subjectId,
      gradeId,
      periodsPerWeek,
    );
  }

  /**
   * Gán nhiều subject_grades cùng lúc trong transaction
   */
  async bulkUpsertSubjectGrades(
    subjectId: string,
    grades: SubjectGradeInput[],
  ): Promise<SubjectGradeEntity[]> {
    // Validate subject tồn tại
    await this.findById(subjectId);

    return this.dataSource.transaction(async (manager) => {
      const subjectGradeRepo = manager.getRepository(SubjectGradeEntity);
      const results: SubjectGradeEntity[] = [];

      for (const grade of grades) {
        const existing = await subjectGradeRepo.findOne({
          where: {
            subjectId,
            gradeId: grade.gradeId,
            deletedAt: IsNull(),
          },
        });

        if (existing) {
          existing.periodsPerWeek = grade.periodsPerWeek;
          results.push(await subjectGradeRepo.save(existing));
        } else {
          const entity = subjectGradeRepo.create({
            subjectId,
            gradeId: grade.gradeId,
            periodsPerWeek: grade.periodsPerWeek,
          });
          results.push(await subjectGradeRepo.save(entity));
        }
      }

      return results;
    });
  }

  /**
   * Lấy danh sách số tiết theo khối của một môn
   */
  async getSubjectGrades(subjectId: string): Promise<SubjectGradeEntity[]> {
    await this.findById(subjectId);
    return this.subjectRepository.findGradesBySubject(subjectId);
  }

  /**
   * Xóa phân bổ số tiết theo khối
   */
  async removeSubjectGrade(subjectId: string, gradeId: string): Promise<void> {
    await this.findById(subjectId);
    await this.subjectRepository.deleteSubjectGrade(subjectId, gradeId);
  }

  /**
   * Validate mã môn học không trùng trong cùng trường
   * @throws DuplicateSubjectCodeException nếu mã đã tồn tại
   */
  private async validateUniqueCode(
    schoolId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.subjectRepository.findByCode(schoolId, code);
    if (existing && existing.id !== excludeId) {
      throw new DuplicateSubjectCodeException();
    }
  }

  /**
   * Tạo mã màu tự động dựa trên index
   */
  private generateColor(index: number): string {
    const colors = [
      '#3b82f6',
      '#ef4444',
      '#10b981',
      '#f59e0b',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
      '#f97316',
      '#6366f1',
      '#14b8a6',
      '#e11d48',
      '#0ea5e9',
      '#a855f7',
      '#22c55e',
      '#eab308',
      '#d946ef',
      '#0891b2',
      '#65a30d',
      '#dc2626',
    ];
    return colors[index % colors.length];
  }
}
