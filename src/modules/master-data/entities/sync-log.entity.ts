import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SyncDirection, SyncStatus } from '../enums/master-data.enum';

@Entity('sync_logs')
export class SyncLogEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'employee_code', type: 'varchar', length: 20 })
  employeeCode: string;

  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string;

  @Column({ name: 'master_value', type: 'text', nullable: true })
  masterValue: string | null;

  @Column({ name: 'module_value', type: 'text', nullable: true })
  moduleValue: string | null;

  @Column({ name: 'source_module', type: 'varchar', length: 50 })
  sourceModule: string;

  @Column({ type: 'enum', enum: SyncDirection })
  direction: SyncDirection;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.PENDING })
  status: SyncStatus;

  @Column({ name: 'resolved_by', type: 'varchar', length: 100, nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;
}
