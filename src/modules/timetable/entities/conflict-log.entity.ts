import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  ConflictType,
  ConflictSeverity,
  ValidationContext,
  ConflictLogStatus,
} from '../enums/conflict.enum';
import { ConflictDetails } from '../interfaces/conflict.interface';
import { TimetableVersionEntity } from './timetable-version.entity';

@Entity('timetable_conflict_logs')
export class ConflictLogEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @Column({ name: 'conflict_type', type: 'varchar', length: 50 })
  conflictType: ConflictType;

  @Column({ type: 'varchar', length: 10 })
  severity: ConflictSeverity;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @Column({ name: 'conflicting_slot_id', type: 'uuid', nullable: true })
  conflictingSlotId: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  details: ConflictDetails | null;

  @Column({ name: 'validation_context', type: 'varchar', length: 20 })
  validationContext: ValidationContext;

  @Column({ type: 'varchar', length: 20, default: ConflictLogStatus.DETECTED })
  status: ConflictLogStatus;

  @Column({ name: 'detected_at', type: 'timestamp', default: () => 'NOW()' })
  detectedAt: Date;

  @Column({ name: 'overridden_by', type: 'uuid', nullable: true })
  overriddenBy: string | null;

  @Column({ name: 'overridden_at', type: 'timestamp', nullable: true })
  overriddenAt: Date | null;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string | null;

  // Relations
  @ManyToOne(() => TimetableVersionEntity)
  @JoinColumn({ name: 'version_id' })
  timetableVersion: TimetableVersionEntity;
}
