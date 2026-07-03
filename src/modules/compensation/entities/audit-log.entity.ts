import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../auth/entities/user.entity';

@Entity('compensation_audit_logs')
export class AuditLogEntity extends BaseEntity {
  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 20 })
  action: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue: Record<string, unknown> | null;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: Record<string, unknown> | null;

  @Column({ name: 'performed_by', type: 'uuid' })
  performedBy: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'performed_by' })
  performer: UserEntity;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
