import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SalarySlipStatus } from '../enums';
import { SalarySlipItem, CalculationSnapshot, CalculationError } from '../interfaces';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { PayPeriodEntity } from './pay-period.entity';

@Entity('salary_slips')
export class SalarySlipEntity extends BaseEntity {
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacher_id' })
  teacher: TeacherEntity;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'pay_period_id', type: 'uuid' })
  payPeriodId: string;

  @ManyToOne(() => PayPeriodEntity)
  @JoinColumn({ name: 'pay_period_id' })
  payPeriod: PayPeriodEntity;

  @Column({ type: 'jsonb' })
  earnings: SalarySlipItem[];

  @Column({ type: 'jsonb' })
  deductions: SalarySlipItem[];

  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossAmount: number;

  @Column({ name: 'total_deductions', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  netAmount: number;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: CalculationSnapshot | null;

  @Column({ type: 'enum', enum: SalarySlipStatus, default: SalarySlipStatus.DRAFT })
  status: SalarySlipStatus;

  @Column({ type: 'jsonb', nullable: true })
  errors: CalculationError[] | null;
}
