import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SalarySlipStatus } from '../enums';
import { SalarySlipItem, CalculationSnapshot, CalculationError } from '../interfaces';

@Entity('salary_slips')
export class SalarySlipEntity extends BaseEntity {
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'pay_period_id', type: 'uuid' })
  payPeriodId: string;

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
