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

  async findAll(query: GradeQueryDto): Promise<[GradeEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('grade')
      .where('grade.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('grade.schoolId = :schoolId', { schoolId });
    }

    if (sortBy) {
      queryBuilder.orderBy(`grade.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('grade.level', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<GradeEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true },
    });
  }

  async create(data: Partial<GradeEntity>): Promise<GradeEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<GradeEntity>): Promise<GradeEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
