import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SemesterEntity } from '../../academic/entities/semester.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';

@Entity('teaching_assignments')
@Unique(['semesterId', 'teacherId', 'classId', 'subjectId'])
export class TeachingAssignmentEntity extends BaseEntity {
  @Column({ name: 'semester_id', type: 'uuid' })
  semesterId: string;

  @ManyToOne(() => SemesterEntity)
  @JoinColumn({ name: 'semester_id' })
  semester: SemesterEntity;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacher_id' })
  teacher: TeacherEntity;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity)
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity;

  @Column({ name: 'periods_per_week', type: 'int' })
  periodsPerWeek: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
