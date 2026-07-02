import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditLogQueryDto } from '../dto/audit/audit-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class AuditService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Log a change. This is the primary entry point for creating audit records.
   * Immutable: no update or delete methods exist.
   */
  async logChange(
    entityType: string,
    entityId: string,
    action: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
    performedBy: string,
    metadata?: Record<string, unknown>,
  ): Promise<AuditLogEntity> {
    return this.auditLogRepository.create({
      entityType,
      entityId,
      action,
      oldValue,
      newValue,
      performedBy,
      metadata: metadata || null,
    });
  }

  /**
   * Find audit logs with filters.
   */
  async findAll(query: AuditLogQueryDto): Promise<PaginatedResponse<AuditLogEntity>> {
    const [data, total] = await this.auditLogRepository.findAllWithFilters(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách audit log thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }
}
