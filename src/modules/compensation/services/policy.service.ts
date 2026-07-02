import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PolicyRepository } from '../repositories/policy.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompensationPolicyEntity } from '../entities/compensation-policy.entity';
import { CreatePolicyDto } from '../dto/policy/create-policy.dto';
import { UpdatePolicyDto } from '../dto/policy/update-policy.dto';
import { PolicyQueryDto } from '../dto/policy/policy-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { EntityStatus } from '../../../common/enums/status.enum';

@Injectable()
export class PolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async findAll(query: PolicyQueryDto): Promise<PaginatedResponse<CompensationPolicyEntity>> {
    const [data, total] = await this.policyRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách chính sách lương thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<CompensationPolicyEntity> {
    const entity = await this.policyRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Không tìm thấy chính sách lương');
    }
    return entity;
  }

  async create(dto: CreatePolicyDto, performedBy?: string): Promise<CompensationPolicyEntity> {
    // Validate overlap
    const overlapping = await this.policyRepository.findOverlapping(
      dto.schoolId,
      dto.campusId || null,
      dto.schoolLevel || null,
      dto.effectiveFrom,
      dto.effectiveTo || null,
    );

    if (overlapping.length > 0) {
      throw new BadRequestException(
        `Chính sách lương trùng phạm vi và thời gian với: ${overlapping.map((p) => p.name).join(', ')}. ` +
        'Vui lòng thay đổi thời gian hiệu lực hoặc vô hiệu hóa chính sách cũ.',
      );
    }

    const entity = await this.policyRepository.create({
      schoolId: dto.schoolId,
      name: dto.name,
      campusId: dto.campusId || null,
      schoolLevel: dto.schoolLevel || null,
      payComponentIds: dto.payComponentIds,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo || null,
      status: EntityStatus.ACTIVE,
    });

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'policy',
        entityId: entity.id,
        action: 'create',
        oldValue: null,
        newValue: entity as unknown as Record<string, unknown>,
        performedBy,
      });
    }

    return entity;
  }

  async update(id: string, dto: UpdatePolicyDto, performedBy?: string): Promise<CompensationPolicyEntity> {
    const entity = await this.findById(id);
    const oldValue = { ...entity } as unknown as Record<string, unknown>;

    // If changing scope or dates, validate overlap
    if (dto.effectiveFrom || dto.effectiveTo !== undefined || dto.campusId !== undefined || dto.schoolLevel !== undefined) {
      const overlapping = await this.policyRepository.findOverlapping(
        entity.schoolId,
        dto.campusId !== undefined ? dto.campusId || null : entity.campusId,
        dto.schoolLevel !== undefined ? dto.schoolLevel || null : entity.schoolLevel,
        dto.effectiveFrom || entity.effectiveFrom,
        dto.effectiveTo !== undefined ? dto.effectiveTo || null : entity.effectiveTo,
        id,
      );

      if (overlapping.length > 0) {
        throw new BadRequestException(
          `Chính sách lương trùng phạm vi và thời gian với: ${overlapping.map((p) => p.name).join(', ')}`,
        );
      }
    }

    const updated = await this.policyRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.campusId !== undefined && { campusId: dto.campusId || null }),
      ...(dto.schoolLevel !== undefined && { schoolLevel: dto.schoolLevel || null }),
      ...(dto.payComponentIds !== undefined && { payComponentIds: dto.payComponentIds }),
      ...(dto.effectiveFrom !== undefined && { effectiveFrom: dto.effectiveFrom }),
      ...(dto.effectiveTo !== undefined && { effectiveTo: dto.effectiveTo || null }),
      ...(dto.status !== undefined && { status: dto.status }),
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy chính sách lương');
    }

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'policy',
        entityId: id,
        action: 'update',
        oldValue,
        newValue: updated as unknown as Record<string, unknown>,
        performedBy,
      });
    }

    return updated;
  }

  /**
   * Resolve the most specific policy for a teacher context.
   * Priority: campus+level > campus > level > school (general)
   */
  async resolvePolicy(
    schoolId: string,
    campusId: string | null,
    schoolLevel: string | null,
    asOfDate: string,
  ): Promise<CompensationPolicyEntity | null> {
    const policies = await this.policyRepository.findActiveByScope(
      schoolId,
      campusId,
      schoolLevel,
      asOfDate,
    );

    if (policies.length === 0) return null;

    // Score-based priority: more specific scope wins
    const scored = policies.map((policy) => {
      let score = 0;
      if (policy.campusId && policy.campusId === campusId) score += 2;
      if (policy.schoolLevel && policy.schoolLevel === schoolLevel) score += 1;
      return { policy, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].policy;
  }
}
