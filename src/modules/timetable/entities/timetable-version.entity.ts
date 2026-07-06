import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { SemesterEntity } from '../../academic/entities/semester.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TimetableSlotEntity } from './timetable-slot.entity';

@Entity('timetable_versions')
export class TimetableVersionEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => SchoolEntity, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity | null;

  @Column({ name: 'semester_id', type: 'uuid' })
  semesterId: string;

  @ManyToOne(() => SemesterEntity)
  @JoinColumn({ name: 'semester_id' })
  semester: SemesterEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({
    type: 'enum',
    enum: TimetableVersionStatus,
    default: TimetableVersionStatus.DRAFT,
  })
  status: TimetableVersionStatus;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: string | null;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Pipeline columns
  @Column({ name: 'job_id', type: 'varchar', length: 100, nullable: true })
  jobId: string | null;

  @Column({ name: 'generation_started_at', type: 'timestamp', nullable: true })
  generationStartedAt: Date | null;

  @Column({
    name: 'generation_completed_at',
    type: 'timestamp',
    nullable: true,
  })
  generationCompletedAt: Date | null;

  @Column({ name: 'generation_duration_ms', type: 'int', nullable: true })
  generationDurationMs: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack: string | null;

  @Column({ name: 'has_conflicts', type: 'boolean', default: false })
  hasConflicts: boolean;

  @Column({ name: 'conflict_count', type: 'int', default: 0 })
  conflictCount: number;

  @Column({ name: 'conflict_details', type: 'jsonb', nullable: true })
  conflictDetails: object[] | null;

  @Column({ name: 'total_slots', type: 'int', default: 0 })
  totalSlots: number;

  // Relations
  @OneToMany(() => TimetableSlotEntity, (slot) => slot.timetableVersion)
  slots: TimetableSlotEntity[];
}
