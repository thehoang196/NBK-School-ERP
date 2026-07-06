import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { VariableEntity } from '../entities/variable.entity';
import { VariableOverrideEntity } from '../entities/variable-override.entity';
import { VariableQueryDto } from '../dto/variable/variable-query.dto';

@Injectable()
export class VariableRepository {
  constructor(
    @InjectRepository(VariableEntity)
    private readonly repo: Repository<VariableEntity>,
    @InjectRepository(VariableOverrideEntity)
    private readonly overrideRepo: Repository<VariableOverrideEntity>,
  ) {}

  async findAll(query: VariableQueryDto): Promise<[VariableEntity[], number]> {
    const { page, limit, sortBy, sortOrder, scope, dataType, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('v')
      .where('v.deletedAt IS NULL');

    if (scope) {
      queryBuilder.andWhere('v.scope = :scope', { scope });
    }

    if (dataType) {
      queryBuilder.andWhere('v.dataType = :dataType', { dataType });
    }

    if (search) {
      queryBuilder.andWhere('(v.name ILIKE :search OR v.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`v.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('v.code', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<VariableEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findByCode(code: string): Promise<VariableEntity | null> {
    return this.repo.findOne({
      where: { code, deletedAt: IsNull() },
    });
  }

  async findByCodes(codes: string[]): Promise<VariableEntity[]> {
    if (codes.length === 0) return [];
    return this.repo
      .createQueryBuilder('v')
      .where('v.code IN (:...codes)', { codes })
      .andWhere('v.deletedAt IS NULL')
      .getMany();
  }

  async create(data: Partial<VariableEntity>): Promise<VariableEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<VariableEntity>,
  ): Promise<VariableEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  // Override methods
  async findOverrides(variableId: string): Promise<VariableOverrideEntity[]> {
    return this.overrideRepo.find({
      where: { variableId, deletedAt: IsNull() },
      order: { scope: 'ASC' },
    });
  }

  async findOverridesByContext(
    variableId: string,
    schoolId?: string,
    schoolLevel?: string,
  ): Promise<VariableOverrideEntity[]> {
    const queryBuilder = this.overrideRepo
      .createQueryBuilder('o')
      .where('o.variableId = :variableId', { variableId })
      .andWhere('o.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('(o.scopeId = :schoolId OR o.scopeId IS NULL)', {
        schoolId,
      });
    }

    if (schoolLevel) {
      queryBuilder.andWhere(
        '(o.scopeLevel = :schoolLevel OR o.scopeLevel IS NULL)',
        { schoolLevel },
      );
    }

    return queryBuilder.getMany();
  }

  async createOverride(
    data: Partial<VariableOverrideEntity>,
  ): Promise<VariableOverrideEntity> {
    const entity = this.overrideRepo.create(data);
    return this.overrideRepo.save(entity);
  }

  async updateOverride(
    id: string,
    data: Partial<VariableOverrideEntity>,
  ): Promise<VariableOverrideEntity | null> {
    await this.overrideRepo.update(id, data);
    return this.overrideRepo.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async deleteOverride(id: string): Promise<void> {
    await this.overrideRepo.softDelete(id);
  }
}
