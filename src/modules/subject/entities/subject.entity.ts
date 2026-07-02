import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SubjectType, RoomType } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('subjects')
export class SubjectEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 10, nullable: true })
  shortName: string | null;

  @Column({ name: 'subject_type', type: 'enum', enum: SubjectType, default: SubjectType.REQUIRED })
  subjectType: SubjectType;

  @Column({ name: 'periods_per_week', type: 'int', default: 0 })
  periodsPerWeek: number;

  @Column({ name: 'requires_room_type', type: 'enum', enum: RoomType, default: RoomType.STANDARD })
  requiresRoomType: RoomType;

  @Column({ name: 'color_code', type: 'varchar', length: 7, nullable: true })
  colorCode: string | null;

  @Column({ name: 'is_double_period', type: 'boolean', default: false })
  isDoublePeriod: boolean;
}
