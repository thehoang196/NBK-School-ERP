import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TimetableVersionEntity } from './timetable-version.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { RoomEntity } from '../../room/entities/room.entity';

@Entity('timetable_slots')
export class TimetableSlotEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @ManyToOne(() => TimetableVersionEntity, (v) => v.slots)
  @JoinColumn({ name: 'version_id' })
  timetableVersion: TimetableVersionEntity;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number; // 2-7 (Thứ 2 - Thứ 7)

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => PeriodDefinitionEntity)
  @JoinColumn({ name: 'period_id' })
  period: PeriodDefinitionEntity;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacher_id' })
  teacher: TeacherEntity;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity)
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @ManyToOne(() => RoomEntity, { nullable: true })
  @JoinColumn({ name: 'room_id' })
  room: RoomEntity | null;

  @Column({ name: 'is_double_period', type: 'boolean', default: false })
  isDoublePeriod: boolean;
}
