import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { FieldDataType } from '../enums/master-data.enum';
import { ValidationRules } from '../interfaces/reconciliation.interface';

@Entity('field_definitions')
@Unique(['schoolId', 'fieldName'])
export class FieldDefinitionEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string;

  @Column({ name: 'data_type', type: 'varchar', length: 20 })
  dataType: FieldDataType;

  @Column({ name: 'source_module', type: 'varchar', length: 50 })
  sourceModule: string;

  @Column({ name: 'display_label', type: 'varchar', length: 100 })
  displayLabel: string;

  @Column({ name: 'validation_rules', type: 'jsonb', nullable: true })
  validationRules: ValidationRules | null;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;
}
