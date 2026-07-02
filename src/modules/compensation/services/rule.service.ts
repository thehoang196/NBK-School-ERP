import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { RuleRepository } from '../repositories/rule.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleEntity } from '../entities/rule.entity';
import { CreateRuleDto } from '../dto/rule/create-rule.dto';
import { UpdateRuleDto } from '../dto/rule/update-rule.dto';
import { RuleQueryDto } from '../dto/rule/rule-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { EntityStatus } from '../../../common/enums/status.enum';
import { RuleCondition } from '../interfaces';

export interface ConflictWarning {
  conflictingRuleId: string;
  conflictingRuleName: string;
  priority: number;
  message: string;
}

@Injectable()
export class RuleService {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async findAll(query: RuleQueryDto): Promise<PaginatedResponse<RuleEntity>> {
    const [data, total] = await this.ruleRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách quy tắc thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<RuleEntity> {
    const entity = await this.ruleRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Không tìm thấy quy tắc');
    }
    return entity;
  }

  async create(dto: CreateRuleDto, performedBy?: string): Promise<{ rule: RuleEntity; warnings: ConflictWarning[] }> {
    const priority = dto.priority ?? 0;

    // Check for conflicts at same priority
    const warnings = await this.detectConflicts(dto.schoolId, priority, dto.conditions as RuleCondition[]);

    const entity = await this.ruleRepository.create({
      schoolId: dto.schoolId,
      name: dto.name,
      conditions: dto.conditions as RuleCondition[],
      actionType: dto.actionType,
      actionTarget: dto.actionTarget,
      actionValue: dto.actionValue,
      priority,
      status: EntityStatus.ACTIVE,
    });

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'rule',
        entityId: entity.id,
        action: 'create',
        oldValue: null,
        newValue: entity as unknown as Record<string, unknown>,
        performedBy,
      });
    }

    return { rule: entity, warnings };
  }

  async update(id: string, dto: UpdateRuleDto, performedBy?: string): Promise<{ rule: RuleEntity; warnings: ConflictWarning[] }> {
    const entity = await this.findById(id);
    const oldValue = { ...entity } as unknown as Record<string, unknown>;

    let warnings: ConflictWarning[] = [];

    // Check conflicts if priority or conditions changed
    if (dto.priority !== undefined || dto.conditions !== undefined) {
      const priority = dto.priority ?? entity.priority;
      const conditions = (dto.conditions as RuleCondition[] | undefined) ?? entity.conditions;
      warnings = await this.detectConflicts(entity.schoolId, priority, conditions, id);
    }

    const updated = await this.ruleRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.conditions !== undefined && { conditions: dto.conditions as RuleCondition[] }),
      ...(dto.actionType !== undefined && { actionType: dto.actionType }),
      ...(dto.actionTarget !== undefined && { actionTarget: dto.actionTarget }),
      ...(dto.actionValue !== undefined && { actionValue: dto.actionValue }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.status !== undefined && { status: dto.status }),
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy quy tắc');
    }

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'rule',
        entityId: id,
        action: 'update',
        oldValue,
        newValue: updated as unknown as Record<string, unknown>,
        performedBy,
      });
    }

    return { rule: updated, warnings };
  }

  async softDelete(id: string, performedBy?: string): Promise<void> {
    const entity = await this.findById(id);

    await this.ruleRepository.softDelete(id);

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'rule',
        entityId: id,
        action: 'delete',
        oldValue: entity as unknown as Record<string, unknown>,
        newValue: null,
        performedBy,
      });
    }
  }

  /**
   * Detect potential conflicts: same priority covering the same scope.
   */
  private async detectConflicts(
    schoolId: string,
    priority: number,
    conditions: RuleCondition[],
    excludeRuleId?: string,
  ): Promise<ConflictWarning[]> {
    const samePriorityRules = await this.ruleRepository.findByPriorityAndSchool(priority, schoolId);
    const warnings: ConflictWarning[] = [];

    for (const existingRule of samePriorityRules) {
      if (excludeRuleId && existingRule.id === excludeRuleId) continue;

      // Check if conditions overlap (simplified: check if same fields are targeted)
      const overlap = this.hasConditionOverlap(conditions, existingRule.conditions);
      if (overlap) {
        warnings.push({
          conflictingRuleId: existingRule.id,
          conflictingRuleName: existingRule.name,
          priority,
          message: `Xung đột tiềm năng với quy tắc "${existingRule.name}" (cùng mức ưu tiên ${priority})`,
        });
      }
    }

    return warnings;
  }

  /**
   * Check if two sets of conditions potentially overlap.
   * Simple heuristic: if they target the same fields with similar scope.
   */
  private hasConditionOverlap(conditionsA: RuleCondition[], conditionsB: RuleCondition[]): boolean {
    const fieldsA = new Set(conditionsA.map((c) => c.field));
    const fieldsB = new Set(conditionsB.map((c) => c.field));

    // If they share same fields, they might conflict
    for (const field of fieldsA) {
      if (fieldsB.has(field)) {
        return true;
      }
    }

    return false;
  }
}
