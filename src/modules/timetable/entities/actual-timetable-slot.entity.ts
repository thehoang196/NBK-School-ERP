import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SlotStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { SemesterEntity } from '../../academic/entities/semester.entity';
import { WeekEntity } from '../../academic/entities/week.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { RoomEntity } from '../../room/entities/room.entity';

@Entity('actual_timetable_slots')
@Index(['schoolId', 'deletedAt'])
export class ActualTimetableSlotEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'semester_id', type: 'uuid' })
  semesterId: string;

  @ManyToOne(() => SemesterEntity)
  @JoinColumn({ name: 'semester_id' })
  semester: SemesterEntity;

  @Column({ name: 'week_id', type: 'uuid' })
  weekId: string;

  @ManyToOne(() => WeekEntity)
  @JoinColumn({ name: 'week_id' })
  week: WeekEntity;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

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

  @Column({ name: 'original_teacher_id', type: 'uuid', nullable: true })
  originalTeacherId: string | null;

  @Column({
    name: 'slot_status',
    type: 'enum',
    enum: SlotStatus,
    default: SlotStatus.SCHEDULED,
  })
  slotStatus: SlotStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
