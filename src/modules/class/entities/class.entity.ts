import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EntityStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { GradeEntity } from './grade.entity';
import { AcademicYearEntity } from '../../academic/entities/academic-year.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';

@Entity('classes')
@Index('idx_classes_school_deleted', ['schoolId', 'deletedAt'])
export class ClassEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'grade_id', type: 'uuid' })
  gradeId: string;

  @ManyToOne(() => GradeEntity)
  @JoinColumn({ name: 'grade_id' })
  grade: GradeEntity;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYearEntity)
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYearEntity;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ name: 'homeroom_teacher_id', type: 'uuid', nullable: true })
  homeroomTeacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true })
  @JoinColumn({ name: 'homeroom_teacher_id' })
  homeroomTeacher: TeacherEntity | null;

  @Column({ name: 'student_count', type: 'int', default: 0 })
  studentCount: number;

  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
}
