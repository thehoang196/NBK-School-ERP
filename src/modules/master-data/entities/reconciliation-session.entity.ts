import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReconciliationStatus } from '../enums/master-data.enum';
import { ReconciliationReportData } from '../interfaces/reconciliation.interface';

@Entity('reconciliation_sessions')
export class ReconciliationSessionEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'source_module', type: 'varchar', length: 50 })
  sourceModule: string;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.IN_PROGRESS,
  })
  status: ReconciliationStatus;

  @Column({ name: 'total_records', type: 'int', default: 0 })
  totalRecords: number;

  @Column({ name: 'matched_records', type: 'int', default: 0 })
  matchedRecords: number;

  @Column({ name: 'conflict_records', type: 'int', default: 0 })
  conflictRecords: number;

  @Column({ name: 'new_records', type: 'int', default: 0 })
  newRecords: number;

  @Column({ name: 'report_data', type: 'jsonb', nullable: true })
  reportData: ReconciliationReportData | null;

  @Column({ name: 'triggered_by', type: 'varchar', length: 100 })
  triggeredBy: string;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
