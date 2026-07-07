import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  Gender,
  TeacherType,
  TeacherStatus,
} from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { GradeEntity } from '../../class/entities/grade.entity';
import { DepartmentEntity } from '../../department/entities/department.entity';

export interface UnavailableSlot {
  dayOfWeek: number;
  periodId: string;
}

@Entity('teachers')
@Index('idx_teachers_school_deleted', ['schoolId', 'deletedAt'])
export class TeacherEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'employee_code', type: 'varchar', length: 20, unique: true })
  employeeCode: string;

  @Column({ name: 'citizen_id', type: 'varchar', length: 20, nullable: true })
  citizenId: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ name: 'short_name', type: 'varchar', length: 50, nullable: true })
  shortName: string | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ name: 'grade_id', type: 'uuid', nullable: true })
  gradeId: string | null;

  @ManyToOne(() => GradeEntity)
  @JoinColumn({ name: 'grade_id' })
  grade: GradeEntity;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => DepartmentEntity)
  @JoinColumn({ name: 'department_id' })
  department: DepartmentEntity;

  @Column({ name: 'job_title', type: 'varchar', length: 100, nullable: true })
  jobTitle: string | null;

  @Column({
    name: 'management_level',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  managementLevel: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  position: string | null;

  @Column({
    name: 'teacher_type',
    type: 'enum',
    enum: TeacherType,
    default: TeacherType.FULL_TIME,
  })
  teacherType: TeacherType;

  @Column({ name: 'max_periods_per_week', type: 'int', default: 20 })
  maxPeriodsPerWeek: number;

  @Column({ name: 'min_periods_per_week', type: 'int', default: 0 })
  minPeriodsPerWeek: number;

  @Column({ name: 'max_periods_per_day', type: 'int', default: 6 })
  maxPeriodsPerDay: number;

  @Column({ name: 'unavailable_slots', type: 'jsonb', nullable: true })
  unavailableSlots: UnavailableSlot[] | null;

  @Column({ type: 'enum', enum: TeacherStatus, default: TeacherStatus.ACTIVE })
  status: TeacherStatus;
}
