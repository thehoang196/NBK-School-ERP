import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';

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

  async findAll(
    query: AuditLogQueryDto,
    schoolId: string | null,
  ): Promise<[AuditLogEntity[], number]> {
    const where: FindOptionsWhere<AuditLogEntity> = {};

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.startDate && query.endDate) {
      where.createdAt = Between(
        new Date(query.startDate),
        new Date(query.endDate),
      );
    }

    return this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  async findById(id: string): Promise<AuditLogEntity | null> {
    return this.repo.findOne({ where: { id } });
  }
}
