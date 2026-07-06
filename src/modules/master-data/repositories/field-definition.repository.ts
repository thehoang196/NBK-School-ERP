import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FieldDefinitionEntity } from '../entities/field-definition.entity';

@Injectable()
export class FieldDefinitionRepository {
  constructor(
    @InjectRepository(FieldDefinitionEntity)
    private readonly repo: Repository<FieldDefinitionEntity>,
  ) {}

  async findAll(schoolId: string): Promise<FieldDefinitionEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
    });
  }

  async findByFieldName(
    schoolId: string,
    fieldName: string,
  ): Promise<FieldDefinitionEntity | null> {
    return this.repo.findOne({
      where: { schoolId, fieldName, deletedAt: IsNull() },
    });
  }

  async create(
    data: Partial<FieldDefinitionEntity>,
  ): Promise<FieldDefinitionEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<FieldDefinitionEntity>,
  ): Promise<FieldDefinitionEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }
}
