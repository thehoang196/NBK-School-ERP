import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { SyncLogEntity } from '../entities/sync-log.entity';
import { SyncLogQueryDto } from '../dto/sync-log-query.dto';
import { SyncDirection, SyncStatus } from '../enums/master-data.enum';

@Injectable()
export class SyncLogRepository {
  constructor(
    @InjectRepository(SyncLogEntity)
    private readonly repo: Repository<SyncLogEntity>,
  ) {}

  async findAll(query: SyncLogQueryDto): Promise<[SyncLogEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      schoolId,
      employeeCode,
      sourceModule,
      status,
      direction,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('sl')
      .where('sl.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('sl.school_id = :schoolId', { schoolId });
    }

    if (employeeCode) {
      queryBuilder.andWhere('sl.employee_code = :employeeCode', {
        employeeCode,
      });
    }

    if (sourceModule) {
      queryBuilder.andWhere('sl.source_module = :sourceModule', {
        sourceModule,
      });
    }

    if (status) {
      queryBuilder.andWhere('sl.status = :status', { status });
    }

    if (direction) {
      queryBuilder.andWhere('sl.direction = :direction', { direction });
    }

    if (sortBy) {
      queryBuilder.orderBy(`sl.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('sl.created_at', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async create(data: Partial<SyncLogEntity>): Promise<SyncLogEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<SyncLogEntity>,
  ): Promise<SyncLogEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findById(id: string): Promise<SyncLogEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findPendingByEmployeeCode(
    schoolId: string,
    employeeCode: string,
    fieldName: string,
  ): Promise<SyncLogEntity | null> {
    return this.repo.findOne({
      where: {
        schoolId,
        employeeCode,
        fieldName,
        status: SyncStatus.PENDING,
        deletedAt: IsNull(),
      },
    });
  }

  async findRecentMasterChange(
    schoolId: string,
    employeeCode: string,
    fieldName: string,
  ): Promise<SyncLogEntity | null> {
    // Look for a recent master-to-module change for the same employee + field
    // within the last 24 hours (reasonable timeframe for conflict detection)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    return this.repo.findOne({
      where: {
        schoolId,
        employeeCode,
        fieldName,
        direction: SyncDirection.MASTER_TO_MODULE,
        status: In([SyncStatus.PENDING, SyncStatus.APPLIED]),
        deletedAt: IsNull(),
        createdAt: MoreThan(twentyFourHoursAgo),
      },
      order: { createdAt: 'DESC' },
    });
  }
}
