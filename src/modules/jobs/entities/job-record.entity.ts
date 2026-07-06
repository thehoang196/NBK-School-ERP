import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum JobStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
}

export enum JobType {
  TIMETABLE_GENERATION = 'timetable-generation',
  EXCEL_IMPORT = 'excel-import',
  PDF_EXPORT = 'pdf-export',
  EXCEL_EXPORT = 'excel-export',
  CALENDAR_SYNC = 'calendar-sync',
  NOTIFICATION = 'notification',
}

@Entity('job_records')
@Index(['schoolId', 'status'])
@Index(['jobType', 'createdAt'])
export class JobRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'job_type', type: 'varchar', length: 50 })
  jobType: string;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ name: 'bull_job_id', type: 'varchar', length: 100, nullable: true })
  bullJobId: string | null;

  @Column({ name: 'queue_name', type: 'varchar', length: 50, nullable: true })
  queueName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
