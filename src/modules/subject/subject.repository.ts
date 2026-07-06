import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectGradeEntity } from './entities/subject-grade.entity';
import { SubjectQueryDto } from './dto/subject-query.dto';

@Injectable()
export class SubjectRepository {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly repo: Repository<SubjectEntity>,
    @InjectRepository(SubjectGradeEntity)
    private readonly subjectGradeRepo: Repository<SubjectGradeEntity>,
  ) {}

  async findBySchool(schoolId: string): Promise<SubjectEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(query: SubjectQueryDto): Promise<[SubjectEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, subjectType, search } =
      query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('subject')
      .where('subject.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('subject.schoolId = :schoolId', { schoolId });
    }

    if (subjectType) {
      queryBuilder.andWhere('subject.subjectType = :subjectType', {
        subjectType,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(subject.name ILIKE :search OR subject.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`subject.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('subject.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<SubjectEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true },
    });
  }

  async findByCode(
    schoolId: string,
    code: string,
  ): Promise<SubjectEntity | null> {
    return this.repo.findOne({
      where: { schoolId, code, deletedAt: IsNull() },
    });
  }

  async countBySchool(schoolId: string): Promise<number> {
    return this.repo.count({
      where: { schoolId, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<SubjectEntity>): Promise<SubjectEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<SubjectEntity>,
  ): Promise<SubjectEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  // --- SubjectGrade methods ---

  async findGradesBySubject(subjectId: string): Promise<SubjectGradeEntity[]> {
    return this.subjectGradeRepo.find({
      where: { subjectId, deletedAt: IsNull() },
      relations: { grade: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findSubjectsByGrade(gradeId: string): Promise<SubjectGradeEntity[]> {
    return this.subjectGradeRepo.find({
      where: { gradeId, deletedAt: IsNull() },
      relations: { subject: true },
      order: { createdAt: 'ASC' },
    });
  }

  async upsertSubjectGrade(
    subjectId: string,
    gradeId: string,
    periodsPerWeek: number,
  ): Promise<SubjectGradeEntity> {
    const existing = await this.subjectGradeRepo.findOne({
      where: { subjectId, gradeId, deletedAt: IsNull() },
    });

    if (existing) {
      existing.periodsPerWeek = periodsPerWeek;
      return this.subjectGradeRepo.save(existing);
    }

    const entity = this.subjectGradeRepo.create({
      subjectId,
      gradeId,
      periodsPerWeek,
    });
    return this.subjectGradeRepo.save(entity);
  }

  async deleteSubjectGrade(subjectId: string, gradeId: string): Promise<void> {
    const existing = await this.subjectGradeRepo.findOne({
      where: { subjectId, gradeId, deletedAt: IsNull() },
    });
    if (existing) {
      await this.subjectGradeRepo.softDelete(existing.id);
    }
  }
}
