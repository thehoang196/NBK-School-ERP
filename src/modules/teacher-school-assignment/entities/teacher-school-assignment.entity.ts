import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { AssignmentRole } from '../enums/assignment-role.enum';
import { AssignmentStatus } from '../enums/assignment-status.enum';

@Entity('teacher_school_assignments')
@Unique(['teacherId', 'schoolId'])
export class TeacherSchoolAssignmentEntity extends BaseEntity {
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacher_id' })
  teacher: TeacherEntity;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'enum', enum: AssignmentRole })
  role: AssignmentRole;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ACTIVE,
  })
  status: AssignmentStatus;

  @Column({ name: 'effective_start_date', type: 'date' })
  effectiveStartDate: string;

  @Column({ name: 'effective_end_date', type: 'date', nullable: true })
  effectiveEndDate: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
