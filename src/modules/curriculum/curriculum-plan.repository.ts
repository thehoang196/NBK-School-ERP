import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CurriculumPlanEntity } from './entities/curriculum-plan.entity';

@Injectable()
export class CurriculumPlanRepository {
  constructor(
    @InjectRepository(CurriculumPlanEntity)
    private readonly repo: Repository<CurriculumPlanEntity>,
  ) {}

  async findBySchool(schoolId: string): Promise<CurriculumPlanEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      relations: { items: { subject: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<CurriculumPlanEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { items: { subject: true } },
    });
  }

  async findBySchoolAndGrade(
    schoolId: string,
    academicYearId: string,
    gradeId: string,
  ): Promise<CurriculumPlanEntity | null> {
    return this.repo.findOne({
      where: { schoolId, academicYearId, gradeId, deletedAt: IsNull() },
      relations: { items: { subject: true } },
    });
  }

  async create(
    data: Partial<CurriculumPlanEntity>,
  ): Promise<CurriculumPlanEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<CurriculumPlanEntity>,
  ): Promise<CurriculumPlanEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
