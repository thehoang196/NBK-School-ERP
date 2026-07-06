import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { ConflictLogEntity } from '../entities/conflict-log.entity';
import {
  ConflictType,
  ConflictSeverity,
  ConflictLogStatus,
} from '../enums/conflict.enum';

@Injectable()
export class ConflictLogRepository {
  constructor(
    @InjectRepository(ConflictLogEntity)
    private readonly repo: Repository<ConflictLogEntity>,
  ) {}

  /**
   * Create a single conflict log record.
   */
  async createLog(
    data: Partial<ConflictLogEntity>,
  ): Promise<ConflictLogEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  /**
   * Batch create multiple conflict log records.
   * Uses repo.save() with array for batch insert.
   */
  async createManyLogs(
    data: Partial<ConflictLogEntity>[],
  ): Promise<ConflictLogEntity[]> {
    const entities = this.repo.create(data);
    return this.repo.save(entities);
  }

  /**
   * Update a conflict log record to OVERRIDDEN status.
   * Sets overriddenBy, overriddenAt, overrideReason, and status.
   */
  async updateOverride(
    id: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.repo.update(id, {
      status: ConflictLogStatus.OVERRIDDEN,
      overriddenBy: userId,
      overriddenAt: new Date(),
      overrideReason: reason,
    });
  }

  /**
   * Find conflict logs by version with optional filters and pagination.
   * Always filtered by schoolId and deletedAt IS NULL for multi-tenant isolation.
   */
  async findByVersion(
    versionId: string,
    schoolId: string,
    filters?: {
      type?: ConflictType;
      severity?: ConflictSeverity;
      teacherId?: string;
      classId?: string;
      status?: ConflictLogStatus;
    },
    pagination?: { page: number; limit: number },
  ): Promise<[ConflictLogEntity[], number]> {
    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.version_id = :versionId', { versionId })
      .andWhere('log.school_id = :schoolId', { schoolId })
      .andWhere('log.deleted_at IS NULL');

    if (filters?.type) {
      qb.andWhere('log.conflict_type = :type', { type: filters.type });
    }

    if (filters?.severity) {
      qb.andWhere('log.severity = :severity', { severity: filters.severity });
    }

    if (filters?.teacherId) {
      qb.andWhere('log.teacher_id = :teacherId', {
        teacherId: filters.teacherId,
      });
    }

    if (filters?.classId) {
      qb.andWhere('log.class_id = :classId', { classId: filters.classId });
    }

    if (filters?.status) {
      qb.andWhere('log.status = :status', { status: filters.status });
    }

    qb.orderBy('log.detected_at', 'DESC');

    if (pagination) {
      const skip = (pagination.page - 1) * pagination.limit;
      qb.skip(skip).take(pagination.limit);
    }

    return qb.getManyAndCount();
  }

  /**
   * Find conflict logs by IDs, filtered by schoolId for multi-tenant isolation.
   */
  async findByIds(
    ids: string[],
    schoolId: string,
  ): Promise<ConflictLogEntity[]> {
    return this.repo.find({
      where: { id: In(ids), schoolId, deletedAt: IsNull() },
    });
  }

  /**
   * Soft delete conflict logs by version (used when version is deleted).
   * Filtered by schoolId for multi-tenant isolation.
   */
  async softDeleteByVersion(
    versionId: string,
    schoolId: string,
  ): Promise<void> {
    await this.repo.softDelete({ versionId, schoolId });
  }
}
