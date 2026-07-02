import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VariableDataType, VariableScope } from '../enums';

@Entity('compensation_variables')
export class VariableEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'data_type', type: 'enum', enum: VariableDataType })
  dataType: VariableDataType;

  @Column({ name: 'default_value', type: 'varchar', length: 255, nullable: true })
  defaultValue: string | null;

  @Column({ type: 'enum', enum: VariableScope })
  scope: VariableScope;

  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId: string | null;

  @Column({ name: 'scope_level', type: 'varchar', length: 50, nullable: true })
  scopeLevel: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
