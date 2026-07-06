import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

/**
 * Loại rule validation hỗ trợ.
 */
export enum ValidationRuleType {
  /** Kiểm tra giá trị nằm trong khoảng min-max */
  RANGE = 'range',
  /** Kiểm tra giá trị khớp regex pattern */
  REGEX = 'regex',
  /** Kiểm tra giá trị thuộc danh sách cho phép */
  ENUM = 'enum',
  /** Kiểm tra FK reference tồn tại trong bảng khác */
  REFERENCE = 'reference',
  /** Kiểm tra required (not null, not empty) */
  REQUIRED = 'required',
  /** Kiểm tra chiều dài string */
  LENGTH = 'length',
  /** Rule tùy chỉnh với expression */
  CUSTOM = 'custom',
}

/**
 * Entity cho phép validate dựa trên (teacher, subject, class...).
 */
export enum ValidationEntityTarget {
  TEACHER = 'teacher',
  SUBJECT = 'subject',
  CLASS = 'class',
  DEPARTMENT = 'department',
  TIMETABLE_SLOT = 'timetable_slot',
  TEACHING_ASSIGNMENT = 'teaching_assignment',
}

export interface RangeRuleConfig {
  min?: number;
  max?: number;
}

export interface RegexRuleConfig {
  pattern: string;
  flags?: string;
}

export interface EnumRuleConfig {
  allowedValues: string[];
}

export interface ReferenceRuleConfig {
  targetTable: string;
  targetColumn: string;
  scopeBySchool: boolean;
}

export interface LengthRuleConfig {
  min?: number;
  max?: number;
}

export interface CustomRuleConfig {
  /** JavaScript-like expression evaluated against the value. Uses simple operators only. */
  expression: string;
}

export type RuleConfig =
  | RangeRuleConfig
  | RegexRuleConfig
  | EnumRuleConfig
  | ReferenceRuleConfig
  | LengthRuleConfig
  | CustomRuleConfig;

@Entity('validation_rules')
export class ValidationRuleEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'entity_target', type: 'enum', enum: ValidationEntityTarget })
  entityTarget: ValidationEntityTarget;

  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string;

  @Column({ name: 'rule_type', type: 'enum', enum: ValidationRuleType })
  ruleType: ValidationRuleType;

  @Column({ name: 'rule_config', type: 'jsonb' })
  ruleConfig: RuleConfig;

  @Column({ name: 'error_message', type: 'varchar', length: 255 })
  errorMessage: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'priority', type: 'int', default: 0 })
  priority: number;
}
