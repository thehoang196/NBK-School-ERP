import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RoomType, RoomStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('rooms')
export class RoomEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

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

  @Column({ name: 'room_type', type: 'enum', enum: RoomType, default: RoomType.STANDARD })
  roomType: RoomType;

  @Column({ type: 'jsonb', nullable: true })
  facilities: string[] | null;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.AVAILABLE })
  status: RoomStatus;
}
