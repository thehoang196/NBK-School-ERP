import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VariableScope } from '../enums';

@Entity('variable_overrides')
export class VariableOverrideEntity extends BaseEntity {
  @Column({ name: 'variable_id', type: 'uuid' })
  variableId: string;

  @Column({ type: 'enum', enum: VariableScope })
  scope: VariableScope;

  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId: string | null;

  @Column({ name: 'scope_level', type: 'varchar', length: 50, nullable: true })
  scopeLevel: string | null;

  @Column({ type: 'varchar', length: 255 })
  value: string;
}
