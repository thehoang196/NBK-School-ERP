import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CompensationPolicyEntity } from '../entities/compensation-policy.entity';
import { PolicyQueryDto } from '../dto/policy/policy-query.dto';
import { EntityStatus } from '../../../common/enums/status.enum';

@Injectable()
export class PolicyRepository {
  constructor(
    @InjectRepository(CompensationPolicyEntity)
    private readonly repo: Repository<CompensationPolicyEntity>,
  ) {}

  async findAll(query: PolicyQueryDto): Promise<[CompensationPolicyEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, campusId, schoolLevel, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('p')
      .where('p.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('p.schoolId = :schoolId', { schoolId });
    }

    if (campusId) {
      queryBuilder.andWhere('p.campusId = :campusId', { campusId });
    }

    if (schoolLevel) {
      queryBuilder.andWhere('p.schoolLevel = :schoolLevel', { schoolLevel });
    }

    if (status) {
      queryBuilder.andWhere('p.status = :status', { status });
    }

    if (sortBy) {
      queryBuilder.orderBy(`p.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('p.effectiveFrom', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<CompensationPolicyEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findActiveByScope(
    schoolId: string,
    campusId: string | null,
    schoolLevel: string | null,
    asOfDate: string,
  ): Promise<CompensationPolicyEntity[]> {
    const queryBuilder = this.repo.createQueryBuilder('p')
      .where('p.schoolId = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: EntityStatus.ACTIVE })
      .andWhere('p.deletedAt IS NULL')
      .andWhere('p.effectiveFrom <= :asOfDate', { asOfDate })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= :asOfDate)', { asOfDate });

    if (campusId) {
      queryBuilder.andWhere('(p.campusId = :campusId OR p.campusId IS NULL)', { campusId });
    }

    if (schoolLevel) {
      queryBuilder.andWhere('(p.schoolLevel = :schoolLevel OR p.schoolLevel IS NULL)', { schoolLevel });
    }

    return queryBuilder.getMany();
  }

  async findOverlapping(
    schoolId: string,
    campusId: string | null,
    schoolLevel: string | null,
    effectiveFrom: string,
    effectiveTo: string | null,
    excludeId?: string,
  ): Promise<CompensationPolicyEntity[]> {
    const queryBuilder = this.repo.createQueryBuilder('p')
      .where('p.schoolId = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: EntityStatus.ACTIVE })
      .andWhere('p.deletedAt IS NULL')
      .andWhere('p.effectiveFrom <= :endDate', {
        endDate: effectiveTo || '9999-12-31',
      })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= :startDate)', {
        startDate: effectiveFrom,
      });

    // Match same scope
    if (campusId) {
      queryBuilder.andWhere('p.campusId = :campusId', { campusId });
    } else {
      queryBuilder.andWhere('p.campusId IS NULL');
    }

    if (schoolLevel) {
      queryBuilder.andWhere('p.schoolLevel = :schoolLevel', { schoolLevel });
    } else {
      queryBuilder.andWhere('p.schoolLevel IS NULL');
    }

    if (excludeId) {
      queryBuilder.andWhere('p.id != :excludeId', { excludeId });
    }

    return queryBuilder.getMany();
  }

  async create(data: Partial<CompensationPolicyEntity>): Promise<CompensationPolicyEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<CompensationPolicyEntity>): Promise<CompensationPolicyEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
