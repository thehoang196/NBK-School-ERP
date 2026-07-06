import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { SemesterEntity } from './semester.entity';

@Entity('academic_years')
export class AcademicYearEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'varchar', length: 50 })
  name: string; // "2025-2026"

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent: boolean;

  @Column({
    type: 'enum',
    enum: AcademicStatus,
    default: AcademicStatus.PLANNING,
  })
  status: AcademicStatus;

  @OneToMany(() => SemesterEntity, (semester) => semester.academicYear)
  semesters: SemesterEntity[];
}
