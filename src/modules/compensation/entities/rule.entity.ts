import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RuleActionType } from '../enums';
import { EntityStatus } from '../../../common/enums/status.enum';
import { RuleCondition } from '../interfaces';

@Entity('compensation_rules')
export class RuleEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'jsonb' })
  conditions: RuleCondition[];

  @Column({ name: 'action_type', type: 'enum', enum: RuleActionType })
  actionType: RuleActionType;

  @Column({ name: 'action_target', type: 'varchar', length: 50 })
  actionTarget: string;

  @Column({ name: 'action_value', type: 'varchar', length: 255 })
  actionValue: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
}
