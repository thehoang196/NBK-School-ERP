import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RuleEntity } from '../entities/rule.entity';
import { RuleQueryDto } from '../dto/rule/rule-query.dto';
import { EntityStatus } from '../../../common/enums/status.enum';

@Injectable()
export class RuleRepository {
  constructor(
    @InjectRepository(RuleEntity)
    private readonly repo: Repository<RuleEntity>,
  ) {}

  async findAll(query: RuleQueryDto): Promise<[RuleEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, actionType, status, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('r')
      .where('r.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('r.schoolId = :schoolId', { schoolId });
    }

    if (actionType) {
      queryBuilder.andWhere('r.actionType = :actionType', { actionType });
    }

    if (status) {
      queryBuilder.andWhere('r.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('r.name ILIKE :search', { search: `%${search}%` });
    }

    if (sortBy) {
      queryBuilder.orderBy(`r.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('r.priority', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<RuleEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findActiveBySchool(schoolId: string): Promise<RuleEntity[]> {
    return this.repo.find({
      where: { schoolId, status: EntityStatus.ACTIVE, deletedAt: IsNull() },
      order: { priority: 'DESC' },
    });
  }

  async findByPriorityAndSchool(priority: number, schoolId: string): Promise<RuleEntity[]> {
    return this.repo.find({
      where: { priority, schoolId, status: EntityStatus.ACTIVE, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<RuleEntity>): Promise<RuleEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<RuleEntity>): Promise<RuleEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
