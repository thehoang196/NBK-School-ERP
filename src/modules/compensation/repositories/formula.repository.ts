import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FormulaEntity } from '../entities/formula.entity';
import { FormulaQueryDto } from '../dto/formula/formula-query.dto';
import { FormulaStatus } from '../enums';

@Injectable()
export class FormulaRepository {
  constructor(
    @InjectRepository(FormulaEntity)
    private readonly repo: Repository<FormulaEntity>,
  ) {}

  async findAll(query: FormulaQueryDto): Promise<[FormulaEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, payComponentId, status, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('f')
      .where('f.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('f.schoolId = :schoolId', { schoolId });
    }

    if (payComponentId) {
      queryBuilder.andWhere('f.payComponentId = :payComponentId', { payComponentId });
    }

    if (status) {
      queryBuilder.andWhere('f.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('f.expression ILIKE :search', { search: `%${search}%` });
    }

    if (sortBy) {
      queryBuilder.orderBy(`f.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('f.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<FormulaEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findByPayComponentId(payComponentId: string, schoolId: string): Promise<FormulaEntity[]> {
    return this.repo.find({
      where: { payComponentId, schoolId, deletedAt: IsNull() },
      order: { version: 'DESC' },
    });
  }

  async findLatestByPayComponent(payComponentId: string, schoolId: string): Promise<FormulaEntity | null> {
    return this.repo.findOne({
      where: { payComponentId, schoolId, deletedAt: IsNull() },
      order: { version: 'DESC' },
    });
  }

  async findPublishedByPayComponent(payComponentId: string, schoolId: string): Promise<FormulaEntity | null> {
    return this.repo.findOne({
      where: { payComponentId, schoolId, status: FormulaStatus.PUBLISHED, deletedAt: IsNull() },
      order: { version: 'DESC' },
    });
  }

  async findPublishedBySchool(schoolId: string): Promise<FormulaEntity[]> {
    return this.repo.find({
      where: { schoolId, status: FormulaStatus.PUBLISHED, deletedAt: IsNull() },
    });
  }

  async findByVariableRef(variableCode: string): Promise<FormulaEntity[]> {
    return this.repo.createQueryBuilder('f')
      .where('f.deletedAt IS NULL')
      .andWhere('f.status = :status', { status: FormulaStatus.PUBLISHED })
      .andWhere(`f.variableRefs @> :code`, { code: JSON.stringify([variableCode]) })
      .getMany();
  }

  async findByDependency(payComponentCode: string): Promise<FormulaEntity[]> {
    return this.repo.createQueryBuilder('f')
      .where('f.deletedAt IS NULL')
      .andWhere('f.status = :status', { status: FormulaStatus.PUBLISHED })
      .andWhere(`f.dependencies @> :code`, { code: JSON.stringify([payComponentCode]) })
      .getMany();
  }

  async getMaxVersion(payComponentId: string, schoolId: string): Promise<number> {
    const result = await this.repo.createQueryBuilder('f')
      .select('MAX(f.version)', 'maxVersion')
      .where('f.payComponentId = :payComponentId', { payComponentId })
      .andWhere('f.schoolId = :schoolId', { schoolId })
      .getRawOne();

    return result?.maxVersion || 0;
  }

  async create(data: Partial<FormulaEntity>): Promise<FormulaEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<FormulaEntity>): Promise<FormulaEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
