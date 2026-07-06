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

  async findAll(
    query: PeriodDefinitionQueryDto,
    schoolId: string,
  ): Promise<[PeriodDefinitionEntity[], number]> {
    const { page, limit, sortBy, sortOrder, sessionId, gradeLevel } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('periodDefinition')
      .where('periodDefinition.deletedAt IS NULL')
      .andWhere('periodDefinition.schoolId = :schoolId', { schoolId });

    if (sessionId) {
      queryBuilder.andWhere('periodDefinition.sessionId = :sessionId', {
        sessionId,
      });
    }

    if (gradeLevel) {
      queryBuilder.andWhere('periodDefinition.gradeLevel = :gradeLevel', {
        gradeLevel,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`periodDefinition.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('periodDefinition.periodNumber', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(
    id: string,
    schoolId?: string,
  ): Promise<PeriodDefinitionEntity | null> {
    const where: Record<string, unknown> = { id, deletedAt: IsNull() };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    return this.repo.findOne({
      where: where as never,
      relations: { school: true, session: true },
    });
  }

  async findBySession(
    sessionId: string,
    schoolId?: string,
  ): Promise<PeriodDefinitionEntity[]> {
    const where: Record<string, unknown> = { sessionId, deletedAt: IsNull() };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    return this.repo.find({
      where: where as never,
      order: { periodNumber: 'ASC' },
    });
  }

  async findBySessionAndGradeLevel(
    sessionId: string,
    gradeLevel: string,
  ): Promise<PeriodDefinitionEntity[]> {
    return this.repo.find({
      where: {
        sessionId,
        gradeLevel: gradeLevel as never,
        deletedAt: IsNull(),
      },
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

  async create(
    data: Partial<PeriodDefinitionEntity>,
  ): Promise<PeriodDefinitionEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<PeriodDefinitionEntity>,
  ): Promise<PeriodDefinitionEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
