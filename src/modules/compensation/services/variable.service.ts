import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { VariableRepository } from '../repositories/variable.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { VariableEntity } from '../entities/variable.entity';
import { VariableOverrideEntity } from '../entities/variable-override.entity';
import { CreateVariableDto } from '../dto/variable/create-variable.dto';
import { UpdateVariableDto } from '../dto/variable/update-variable.dto';
import { VariableQueryDto } from '../dto/variable/variable-query.dto';
import { CreateVariableOverrideDto } from '../dto/variable/create-variable-override.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { VariableScope } from '../enums';
import { AuditLogEntity } from '../entities/audit-log.entity';

@Injectable()
export class VariableService {
  constructor(
    private readonly variableRepository: VariableRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async findAll(
    query: VariableQueryDto,
  ): Promise<PaginatedResponse<VariableEntity>> {
    const [data, total] = await this.variableRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách biến thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<VariableEntity> {
    const entity = await this.variableRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Không tìm thấy biến');
    }
    return entity;
  }

  async findByCode(code: string): Promise<VariableEntity> {
    const entity = await this.variableRepository.findByCode(code);
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy biến với mã "${code}"`);
    }
    return entity;
  }

  async create(
    dto: CreateVariableDto,
    performedBy?: string,
  ): Promise<VariableEntity> {
    // Validate code format
    if (!/^[A-Z][A-Z0-9_]*$/.test(dto.code)) {
      throw new BadRequestException(
        'Mã biến phải bắt đầu bằng chữ hoa và chỉ chứa chữ hoa, số, gạch dưới',
      );
    }

    // Check uniqueness
    const existing = await this.variableRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Mã biến "${dto.code}" đã tồn tại`);
    }

    const entity = await this.variableRepository.create({
      code: dto.code,
      name: dto.name,
      dataType: dto.dataType,
      defaultValue: dto.defaultValue ?? null,
      scope: dto.scope,
      scopeId: dto.scopeId ?? null,
      scopeLevel: dto.scopeLevel ?? null,
      description: dto.description ?? null,
    });

    // Audit log
    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'variable',
        entityId: entity.id,
        action: 'create',
        oldValue: null,
        newValue: entity as unknown as Record<string, unknown>,
        performedBy,
      });
    }

    return entity;
  }

  async update(
    id: string,
    dto: UpdateVariableDto,
    performedBy?: string,
  ): Promise<VariableEntity> {
    const entity = await this.findById(id);
    const oldValue = { ...entity } as unknown as Record<string, unknown>;

    const updated = await this.variableRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.dataType !== undefined && { dataType: dto.dataType }),
      ...(dto.defaultValue !== undefined && { defaultValue: dto.defaultValue }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.scopeId !== undefined && { scopeId: dto.scopeId }),
      ...(dto.scopeLevel !== undefined && { scopeLevel: dto.scopeLevel }),
      ...(dto.description !== undefined && { description: dto.description }),
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy biến');
    }

    // Audit log with old/new values
    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'variable',
        entityId: id,
        action: 'update',
        oldValue,
        newValue: updated as unknown as Record<string, unknown>,
        performedBy,
      });
    }

    return updated;
  }

  async softDelete(id: string, performedBy?: string): Promise<void> {
    const entity = await this.findById(id);

    // Check if referenced by active (PUBLISHED) formulas
    const referencingFormulas = await this.getReferencingPublishedFormulas(
      entity.code,
    );
    if (referencingFormulas.length > 0) {
      throw new BadRequestException(
        `Không thể xóa biến đang được sử dụng trong các công thức đã publish: ${referencingFormulas.join(', ')}`,
      );
    }

    await this.variableRepository.softDelete(id);

    // Audit log
    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'variable',
        entityId: id,
        action: 'delete',
        oldValue: entity as unknown as Record<string, unknown>,
        newValue: null,
        performedBy,
      });
    }
  }

  // Override management
  async findOverrides(variableId: string): Promise<VariableOverrideEntity[]> {
    await this.findById(variableId); // ensure variable exists
    return this.variableRepository.findOverrides(variableId);
  }

  async createOverride(
    variableId: string,
    dto: CreateVariableOverrideDto,
    performedBy?: string,
  ): Promise<VariableOverrideEntity> {
    await this.findById(variableId); // ensure variable exists

    const override = await this.variableRepository.createOverride({
      variableId,
      scope: dto.scope,
      scopeId: dto.scopeId ?? null,
      scopeLevel: dto.scopeLevel ?? null,
      value: dto.value,
    });

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'variable',
        entityId: variableId,
        action: 'update',
        oldValue: null,
        newValue: { override: override as unknown as Record<string, unknown> },
        performedBy,
        metadata: { type: 'override_created', overrideId: override.id },
      });
    }

    return override;
  }

  async updateOverride(
    overrideId: string,
    dto: Partial<CreateVariableOverrideDto>,
    performedBy?: string,
  ): Promise<VariableOverrideEntity> {
    const updated = await this.variableRepository.updateOverride(overrideId, {
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.scopeId !== undefined && { scopeId: dto.scopeId }),
      ...(dto.scopeLevel !== undefined && { scopeLevel: dto.scopeLevel }),
      ...(dto.value !== undefined && { value: dto.value }),
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy override');
    }

    return updated;
  }

  /**
   * Resolve effective value for a variable given context.
   * Priority: SCHOOL_LEVEL > SCHOOL > SYSTEM (default value)
   */
  async resolveValue(
    code: string,
    context: { schoolId?: string; schoolLevel?: string },
  ): Promise<string | null> {
    const variable = await this.variableRepository.findByCode(code);
    if (!variable) {
      return null;
    }

    const overrides = await this.variableRepository.findOverridesByContext(
      variable.id,
      context.schoolId,
      context.schoolLevel,
    );

    // Priority: SCHOOL_LEVEL > SCHOOL > SYSTEM
    const schoolLevelOverride = overrides.find(
      (o) =>
        o.scope === VariableScope.SCHOOL_LEVEL &&
        o.scopeId === context.schoolId &&
        o.scopeLevel === context.schoolLevel,
    );
    if (schoolLevelOverride) {
      return schoolLevelOverride.value;
    }

    const schoolOverride = overrides.find(
      (o) => o.scope === VariableScope.SCHOOL && o.scopeId === context.schoolId,
    );
    if (schoolOverride) {
      return schoolOverride.value;
    }

    const systemOverride = overrides.find(
      (o) => o.scope === VariableScope.SYSTEM,
    );
    if (systemOverride) {
      return systemOverride.value;
    }

    // Fall back to default value
    return variable.defaultValue;
  }

  async getHistory(variableId: string): Promise<AuditLogEntity[]> {
    await this.findById(variableId); // ensure exists
    return this.auditLogRepository.findByEntity('variable', variableId);
  }

  /**
   * Check if variable code is referenced by published formulas.
   * Will check formula variableRefs JSONB field.
   */
  private async getReferencingPublishedFormulas(
    variableCode: string,
  ): Promise<string[]> {
    // This will be properly integrated when FormulaRepository is available
    // For now, we'll import and query directly if FormulaRepository becomes available
    // TODO: Inject FormulaRepository when circular dependency is resolved
    return [];
  }
}
