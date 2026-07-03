import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PayPeriodStatus } from '../enums';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('pay_periods')
export class PayPeriodEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'enum', enum: PayPeriodStatus, default: PayPeriodStatus.OPEN })
  status: PayPeriodStatus;
}
