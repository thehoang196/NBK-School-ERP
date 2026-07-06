import { Injectable, Logger } from '@nestjs/common';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

export interface CreateAuditLogInput {
  userId: string | null;
  schoolId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Ghi audit log. Method này KHÔNG throw exception — nếu ghi log thất bại,
   * chỉ log error và tiếp tục (không ảnh hưởng business flow).
   */
  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.auditLogRepository.create({
        userId: input.userId,
        schoolId: input.schoolId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        changes: input.changes ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ?? null,
      });
    } catch (error) {
      this.logger.error('Ghi audit log thất bại', {
        input,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async findAll(
    query: AuditLogQueryDto,
    schoolId: string | null,
  ): Promise<PaginatedResponse<AuditLogEntity>> {
    const [data, total] = await this.auditLogRepository.findAll(
      query,
      schoolId,
    );
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

  async findById(id: string): Promise<AuditLogEntity | null> {
    return this.auditLogRepository.findById(id);
  }
}
