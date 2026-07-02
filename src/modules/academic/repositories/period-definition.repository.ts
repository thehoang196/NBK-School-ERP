import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PeriodDefinitionEntity } from '../entities/period-definition.entity';
import { PeriodDefinitionQueryDto } from '../dto/period-definition';

@Injectable()
export class PeriodDefinitionRepository {
  constructor(
    @InjectRepository(PeriodDefinitionEntity)
    private readonly repo: Repository<PeriodDefinitionEntity>,
  ) {}

  async findAll(query: PeriodDefinitionQueryDto): Promise<[PeriodDefinitionEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, sessionId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('periodDefinition')
      .where('periodDefinition.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('periodDefinition.schoolId = :schoolId', { schoolId });
    }

    if (sessionId) {
      queryBuilder.andWhere('periodDefinition.sessionId = :sessionId', { sessionId });
    }

    if (sortBy) {
      queryBuilder.orderBy(`periodDefinition.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('periodDefinition.periodNumber', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<PeriodDefinitionEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true, session: true },
    });
  }

  async findBySession(sessionId: string): Promise<PeriodDefinitionEntity[]> {
    return this.repo.find({
      where: { sessionId, deletedAt: IsNull() },
      order: { periodNumber: 'ASC' },
    });
  }

  async findBySchool(schoolId: string): Promise<PeriodDefinitionEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      relations: { session: true },
      order: { periodNumber: 'ASC' },
    });
  }

  async create(data: Partial<PeriodDefinitionEntity>): Promise<PeriodDefinitionEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<PeriodDefinitionEntity>): Promise<PeriodDefinitionEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
