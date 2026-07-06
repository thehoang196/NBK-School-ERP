import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TeacherEntity } from './teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';

export enum ProficiencyLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

@Entity('teacher_subjects')
@Unique(['teacherId', 'subjectId'])
export class TeacherSubjectEntity extends BaseEntity {
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

  @Column({
    name: 'proficiency_level',
    type: 'enum',
    enum: ProficiencyLevel,
    default: ProficiencyLevel.INTERMEDIATE,
  })
  proficiencyLevel: ProficiencyLevel;

  @Column({ type: 'varchar', length: 200, nullable: true })
  certification: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;
}
