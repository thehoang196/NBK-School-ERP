import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TimetableStatus } from '../../../common/enums/status.enum';
import { SemesterEntity } from '../../academic/entities/semester.entity';
import { TimetableSlotEntity } from './timetable-slot.entity';

@Entity('timetable_versions')
export class TimetableVersionEntity extends BaseEntity {
  @Column({ name: 'semester_id', type: 'uuid' })
  semesterId: string;

  @ManyToOne(() => SemesterEntity)
  @JoinColumn({ name: 'semester_id' })
  semester: SemesterEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'enum', enum: TimetableStatus, default: TimetableStatus.DRAFT })
  status: TimetableStatus;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: string | null;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => TimetableSlotEntity, (slot) => slot.version)
  slots: TimetableSlotEntity[];
}
