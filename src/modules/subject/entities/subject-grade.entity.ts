import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SubjectEntity } from './subject.entity';
import { GradeEntity } from '../../class/entities/grade.entity';

@Entity('subject_grades')
export class SubjectGradeEntity extends BaseEntity {
  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity)
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity;

  @Column({ name: 'grade_id', type: 'uuid' })
  gradeId: string;

  @ManyToOne(() => GradeEntity)
  @JoinColumn({ name: 'grade_id' })
  grade: GradeEntity;

  @Column({ name: 'periods_per_week', type: 'int' })
  periodsPerWeek: number;
}
