import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Gender } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('employee_masters')
@Unique(['schoolId', 'employeeCode'])
export class EmployeeMasterEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'employee_code', type: 'varchar', length: 20 })
  employeeCode: string;

  @Column({ name: 'campus_name', type: 'varchar', length: 100, nullable: true })
  campusName: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ name: 'short_name', type: 'varchar', length: 50, nullable: true })
  shortName: string | null;

  @Column({ name: 'grade_name', type: 'varchar', length: 50, nullable: true })
  gradeName: string | null;

  @Column({
    name: 'department_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  departmentName: string | null;

  @Column({ name: 'job_title', type: 'varchar', length: 100, nullable: true })
  jobTitle: string | null;

  @Column({
    name: 'management_level',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  managementLevel: string | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ name: 'max_periods_per_week', type: 'int', nullable: true })
  maxPeriodsPerWeek: number | null;

  @Column({
    name: 'working_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  workingDays: number | null;

  @Column({ name: 'extended_fields', type: 'jsonb', default: {} })
  extendedFields: Record<string, unknown>;
}
