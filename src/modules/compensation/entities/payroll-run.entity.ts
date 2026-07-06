import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PayrollRunStatus } from '../enums';
import { SchoolEntity } from '../../school/entities/school.entity';
import { PayPeriodEntity } from './pay-period.entity';

/**
 * Payroll Run — đại diện cho một lần chạy tính lương.
 * Workflow: DRAFT → REVIEWED → APPROVED → PAID
 */
@Entity('payroll_runs')
export class PayrollRunEntity extends BaseEntity {
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

  /** Tên mô tả cho lần chạy (VD: "Lương T7/2026 - Lần 1") */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({
    type: 'enum',
    enum: PayrollRunStatus,
    default: PayrollRunStatus.DRAFT,
  })
  status: PayrollRunStatus;

  /** Tổng số giáo viên trong lần chạy */
  @Column({ name: 'total_teachers', type: 'int', default: 0 })
  totalTeachers: number;

  /** Tổng số slip thành công */
  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount: number;

  /** Tổng số slip lỗi */
  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  /** Tổng gross */
  @Column({
    name: 'total_gross',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalGross: number;

  /** Tổng net */
  @Column({
    name: 'total_net',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalNet: number;

  /** Người submit duyệt */
  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  /** Người review */
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  /** Người duyệt cuối cùng */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  /** Ngày đánh dấu đã chi trả */
  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  /** Lý do từ chối (nếu bị reject) */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  /** Ghi chú */
  @Column({ type: 'text', nullable: true })
  note: string | null;
}
