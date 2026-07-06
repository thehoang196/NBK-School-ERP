import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  ValidationRuleEntity,
  ValidationEntityTarget,
} from './entities/validation-rule.entity';

@Injectable()
export class ValidationRulesRepository {
  constructor(
    @InjectRepository(ValidationRuleEntity)
    private readonly repo: Repository<ValidationRuleEntity>,
  ) {}

  /**
   * Lấy tất cả rules active cho một entity + school, sắp xếp theo priority.
   */
  async findActiveRules(
    schoolId: string,
    entityTarget: ValidationEntityTarget,
  ): Promise<ValidationRuleEntity[]> {
    return this.repo.find({
      where: { schoolId, entityTarget, isActive: true, deletedAt: IsNull() },
      order: { priority: 'ASC', fieldName: 'ASC' },
    });
  }

  /**
   * Lấy rules active cho một entity + field cụ thể.
   */
  async findActiveRulesForField(
    schoolId: string,
    entityTarget: ValidationEntityTarget,
    fieldName: string,
  ): Promise<ValidationRuleEntity[]> {
    return this.repo.find({
      where: {
        schoolId,
        entityTarget,
        fieldName,
        isActive: true,
        deletedAt: IsNull(),
      },
      order: { priority: 'ASC' },
    });
  }

  /**
   * Lấy tất cả rules (kể cả inactive) cho CRUD management.
   */
  async findAll(
    schoolId: string,
    entityTarget?: ValidationEntityTarget,
  ): Promise<ValidationRuleEntity[]> {
    const where: Record<string, unknown> = { schoolId, deletedAt: IsNull() };
    if (entityTarget) {
      where['entityTarget'] = entityTarget;
    }
    return this.repo.find({
      where: where as Record<string, unknown>,
      order: { entityTarget: 'ASC', fieldName: 'ASC', priority: 'ASC' },
    });
  }

  async findById(id: string): Promise<ValidationRuleEntity | null> {
    return this.repo.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async create(
    data: Partial<ValidationRuleEntity>,
  ): Promise<ValidationRuleEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<ValidationRuleEntity>,
  ): Promise<ValidationRuleEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
