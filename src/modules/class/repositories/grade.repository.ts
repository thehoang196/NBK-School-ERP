import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GradeEntity } from '../entities/grade.entity';
import { GradeQueryDto } from '../dto/grade-query.dto';

@Injectable()
export class GradeRepository {
  constructor(
    @InjectRepository(GradeEntity)
    private readonly repo: Repository<GradeEntity>,
  ) {}

  async findBySchool(schoolId: string): Promise<GradeEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { level: 'ASC' },
    });
  }

  async findAll(
    schoolId: string,
    query: GradeQueryDto,
  ): Promise<[GradeEntity[], number]> {
    const { page, limit, sortBy, sortOrder, level, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('grade')
      .where('grade.schoolId = :schoolId', { schoolId })
      .andWhere('grade.deletedAt IS NULL');

    if (level !== undefined) {
      queryBuilder.andWhere('grade.level = :level', { level });
    }

    if (search) {
      queryBuilder.andWhere('grade.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`grade.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('grade.level', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string, schoolId?: string): Promise<GradeEntity | null> {
    const where: Record<string, unknown> = { id, deletedAt: IsNull() };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    return this.repo.findOne({ where });
  }

  async create(data: Partial<GradeEntity>): Promise<GradeEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<GradeEntity>,
  ): Promise<GradeEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
