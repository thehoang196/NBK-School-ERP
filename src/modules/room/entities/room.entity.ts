import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RoomType, RoomStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { CampusEntity } from '../../school/entities/campus.entity';

@Entity('rooms')
@Index('idx_rooms_school_deleted', ['schoolId', 'deletedAt'])
export class RoomEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'campus_id', type: 'uuid', nullable: true })
  campusId: string | null;

  @ManyToOne(() => CampusEntity, { nullable: true })
  @JoinColumn({ name: 'campus_id' })
  campus: CampusEntity | null;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  building: string | null;

  @Column({ type: 'int', nullable: true })
  floor: number | null;

  @Column({ type: 'int', default: 40 })
  capacity: number;

  @Column({
    name: 'room_type',
    type: 'enum',
    enum: RoomType,
    default: RoomType.STANDARD,
  })
  roomType: RoomType;

  @Column({ type: 'jsonb', nullable: true })
  facilities: string[] | null;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.AVAILABLE })
  status: RoomStatus;
}
