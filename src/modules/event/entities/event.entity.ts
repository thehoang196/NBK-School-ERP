import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

export enum EventType {
  EXAM = 'exam',
  HOLIDAY = 'holiday',
  EVENT = 'event',
  MEETING = 'meeting',
  OTHER = 'other',
}

export enum EventStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

@Entity('events')
export class EventEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'event_type', type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'all_day', type: 'boolean', default: false })
  allDay: boolean;

  @Column({ name: 'affects_schedule', type: 'boolean', default: false })
  affectsSchedule: boolean;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ name: 'recurrence_rule', type: 'jsonb', nullable: true })
  recurrenceRule: Record<string, unknown> | null;

  @Column({ name: 'affected_grades', type: 'jsonb', nullable: true })
  affectedGrades: string[] | null;

  @Column({ name: 'affected_classes', type: 'jsonb', nullable: true })
  affectedClasses: string[] | null;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.ACTIVE })
  status: EventStatus;
}
