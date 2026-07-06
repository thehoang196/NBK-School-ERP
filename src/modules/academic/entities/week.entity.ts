import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SemesterEntity } from './semester.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { WeekType } from '../enums';

@Entity('weeks')
export class WeekEntity extends BaseEntity {
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

  @Column({ name: 'week_number', type: 'int' })
  weekNumber: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({
    name: 'week_type',
    type: 'enum',
    enum: WeekType,
    default: WeekType.REGULAR,
  })
  weekType: WeekType;

  /**
   * Persisted column: true when week coincides with holidays.
   * Satisfies REQ-3.2: marking weeks that coincide with holidays.
   * Kept in sync with weekType — set to true when weekType is HOLIDAY.
   */
  @Column({ name: 'is_holiday', default: false })
  isHoliday: boolean;
}
