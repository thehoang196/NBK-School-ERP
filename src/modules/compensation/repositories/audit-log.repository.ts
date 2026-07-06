import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditLogQueryDto } from '../dto/audit/audit-query.dto';

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async create(data: Partial<AuditLogEntity>): Promise<AuditLogEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLogEntity[]> {
    return this.repo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByEntityType(
    entityType: string,
    limit = 50,
  ): Promise<AuditLogEntity[]> {
    return this.repo.find({
      where: { entityType },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findAllWithFilters(
    query: AuditLogQueryDto,
  ): Promise<[AuditLogEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      entityType,
      performedBy,
      action,
      dateFrom,
      dateTo,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('al');

    if (entityType) {
      queryBuilder.andWhere('al.entityType = :entityType', { entityType });
    }

    if (performedBy) {
      queryBuilder.andWhere('al.performedBy = :performedBy', { performedBy });
    }

    if (action) {
      queryBuilder.andWhere('al.action = :action', { action });
    }

    if (dateFrom) {
      queryBuilder.andWhere('al.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      queryBuilder.andWhere('al.createdAt <= :dateTo', {
        dateTo: `${dateTo}T23:59:59`,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`al.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('al.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }
}
