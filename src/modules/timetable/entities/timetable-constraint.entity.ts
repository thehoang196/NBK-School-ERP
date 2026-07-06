import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TimetableVersionEntity } from './timetable-version.entity';

export enum ConstraintType {
  MAX_PERIODS_PER_DAY = 'max_periods_per_day',
  MAX_CONSECUTIVE = 'max_consecutive',
  MIN_GAP = 'min_gap',
  PREFERRED_SLOT = 'preferred_slot',
  AVOID_SLOT = 'avoid_slot',
  ROOM_LOCK = 'room_lock',
  TEACHER_UNAVAILABLE = 'teacher_unavailable',
  CLASS_UNAVAILABLE = 'class_unavailable',
  SUBJECT_NOT_AVAILABLE = 'subject_not_available',
  PREFERRED_ROOM = 'preferred_room',
  MAX_HOURS_DAILY = 'max_hours_daily',
  MIN_HOURS_DAILY = 'min_hours_daily',
  BREAK_REQUIRED = 'break_required',
}

export enum ConstraintEntityType {
  TEACHER = 'teacher',
  CLASS = 'class',
  SUBJECT = 'subject',
  ROOM = 'room',
  GLOBAL = 'global',
}

export enum ConstraintPriority {
  REQUIRED = 'required',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * TimetableConstraint — Ràng buộc cho sinh TKB tự động (FET).
 *
 * Lưu cấu hình constraints dưới dạng typed + jsonb parameters.
 * Được FetInputDataCollectorService đọc khi build XML input.
 */
@Entity('timetable_constraints')
@Index(['schoolId', 'timetableVersionId'])
@Index(['constraintType', 'entityType'])
export class TimetableConstraintEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'timetable_version_id', type: 'uuid', nullable: true })
  timetableVersionId: string | null;

  @ManyToOne(() => TimetableVersionEntity, { nullable: true })
  @JoinColumn({ name: 'timetable_version_id' })
  timetableVersion: TimetableVersionEntity | null;

  @Column({
    name: 'constraint_type',
    type: 'enum',
    enum: ConstraintType,
  })
  constraintType: ConstraintType;

  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: ConstraintEntityType,
    default: ConstraintEntityType.GLOBAL,
  })
  entityType: ConstraintEntityType;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({
    type: 'enum',
    enum: ConstraintPriority,
    default: ConstraintPriority.REQUIRED,
  })
  priority: ConstraintPriority;

  @Column({ type: 'jsonb', nullable: true })
  parameters: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
