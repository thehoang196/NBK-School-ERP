import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';
import { AcademicYearEntity } from './academic-year.entity';
import { WeekEntity } from './week.entity';

@Entity('semesters')
export class SemesterEntity extends BaseEntity {
  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYearEntity)
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYearEntity;

  @OneToMany(() => WeekEntity, (week) => week.semester)
  weeks: WeekEntity[];

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ name: 'semester_number', type: 'smallint' })
  semesterNumber: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({
    type: 'enum',
    enum: AcademicStatus,
    default: AcademicStatus.PLANNING,
  })
  status: AcademicStatus;
}
