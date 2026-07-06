import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ImportError } from '../dto/import-result.dto';

export enum ImportBatchStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ImportEntityType {
  TEACHER = 'teacher',
  SUBJECT = 'subject',
  CLASS = 'class',
  DEPARTMENT = 'department',
  TIMETABLE = 'timetable',
}

@Entity('import_batches')
export class ImportBatchEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'entity_type', type: 'enum', enum: ImportEntityType })
  entityType: ImportEntityType;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount: number;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  @Column({ name: 'progress', type: 'int', default: 0 })
  progress: number;

  @Column({
    type: 'enum',
    enum: ImportBatchStatus,
    default: ImportBatchStatus.QUEUED,
  })
  status: ImportBatchStatus;

  @Column({ type: 'jsonb', nullable: true })
  errors: ImportError[] | null;

  @Column({
    name: 'conflict_strategy',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  conflictStrategy: string | null;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId: string;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
