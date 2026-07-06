import { ConflictException, Injectable } from '@nestjs/common';
import { FieldDefinitionRepository } from '../repositories/field-definition.repository';
import { FieldDefinitionEntity } from '../entities/field-definition.entity';
import { RegisterFieldDto } from '../dto/register-field.dto';
import { FieldDataType } from '../enums/master-data.enum';
import { ValidationRules } from '../interfaces/reconciliation.interface';

@Injectable()
export class FieldDefinitionService {
  constructor(
    private readonly fieldDefinitionRepository: FieldDefinitionRepository,
  ) {}

  async register(dto: RegisterFieldDto): Promise<FieldDefinitionEntity> {
    const existing = await this.fieldDefinitionRepository.findByFieldName(
      dto.schoolId,
      dto.fieldName,
    );

    if (existing) {
      throw new ConflictException(
        `Trường '${dto.fieldName}' đã được đăng ký cho trường này`,
      );
    }

    return this.fieldDefinitionRepository.create({
      schoolId: dto.schoolId,
      fieldName: dto.fieldName,
      dataType: dto.dataType,
      sourceModule: dto.sourceModule,
      displayLabel: dto.displayLabel,
      validationRules: dto.validationRules ?? null,
      isRequired: dto.isRequired ?? false,
    });
  }

  async findAll(schoolId: string): Promise<FieldDefinitionEntity[]> {
    return this.fieldDefinitionRepository.findAll(schoolId);
  }

  validateValue(
    fieldDefinition: FieldDefinitionEntity,
    value: unknown,
  ): boolean {
    const { dataType, validationRules } = fieldDefinition;

    switch (dataType) {
      case FieldDataType.STRING:
        return this.validateString(value, validationRules);
      case FieldDataType.NUMBER:
        return this.validateNumber(value, validationRules);
      case FieldDataType.BOOLEAN:
        return typeof value === 'boolean';
      case FieldDataType.DATE:
        return this.validateDate(value);
      case FieldDataType.ENUM:
        return this.validateEnum(value, validationRules);
      default:
        return false;
    }
  }

  private validateString(
    value: unknown,
    rules: ValidationRules | null,
  ): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    if (!rules) {
      return true;
    }

    if (rules.minLength !== undefined && value.length < rules.minLength) {
      return false;
    }

    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      return false;
    }

    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        return false;
      }
    }

    return true;
  }

  private validateNumber(
    value: unknown,
    rules: ValidationRules | null,
  ): boolean {
    if (typeof value !== 'number') {
      return false;
    }

    if (!rules) {
      return true;
    }

    if (rules.min !== undefined && value < rules.min) {
      return false;
    }

    if (rules.max !== undefined && value > rules.max) {
      return false;
    }

    return true;
  }

  private validateDate(value: unknown): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }

    return false;
  }

  private validateEnum(value: unknown, rules: ValidationRules | null): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    if (!rules?.enumValues) {
      return false;
    }

    return rules.enumValues.includes(value);
  }
}
