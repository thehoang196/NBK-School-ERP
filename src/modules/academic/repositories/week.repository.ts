import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { WeekEntity } from '../entities/week.entity';
import { WeekQueryDto } from '../dto/week';

@Injectable()
export class WeekRepository {
  constructor(
    @InjectRepository(WeekEntity)
    private readonly repo: Repository<WeekEntity>,
  ) {}

  async findAll(query: WeekQueryDto): Promise<[WeekEntity[], number]> {
    const { page, limit, sortBy, sortOrder, semesterId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('week')
      .where('week.deletedAt IS NULL');

    if (semesterId) {
      queryBuilder.andWhere('week.semesterId = :semesterId', { semesterId });
    }

    if (sortBy) {
      queryBuilder.orderBy(`week.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('week.weekNumber', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<WeekEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { semester: true },
    });
  }

  async findBySemester(semesterId: string): Promise<WeekEntity[]> {
    return this.repo.find({
      where: { semesterId, deletedAt: IsNull() },
      order: { weekNumber: 'ASC' },
    });
  }

  async create(data: Partial<WeekEntity>): Promise<WeekEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async createMany(data: Partial<WeekEntity>[]): Promise<WeekEntity[]> {
    const entities = this.repo.create(data);
    return this.repo.save(entities);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async softDeleteBySemester(semesterId: string): Promise<void> {
    await this.repo.softDelete({ semesterId });
  }
}
