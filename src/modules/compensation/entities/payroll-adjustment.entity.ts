import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PayComponentType } from '../enums';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { PayPeriodEntity } from './pay-period.entity';

/**
 * Điều chỉnh lương — dùng cho các khoản bổ sung/khấu trừ sau khi kỳ lương đã đóng.
 * Không sửa salary_slip cũ, mà tạo adjustment riêng.
 */
@Entity('payroll_adjustments')
export class PayrollAdjustmentEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacher_id' })
  teacher: TeacherEntity;

  /** Kỳ lương gốc mà adjustment liên quan */
  @Column({ name: 'original_pay_period_id', type: 'uuid' })
  originalPayPeriodId: string;

  @ManyToOne(() => PayPeriodEntity)
  @JoinColumn({ name: 'original_pay_period_id' })
  originalPayPeriod: PayPeriodEntity;

  /** Kỳ lương mà adjustment sẽ được tính vào (thường là kỳ hiện tại) */
  @Column({ name: 'applied_pay_period_id', type: 'uuid', nullable: true })
  appliedPayPeriodId: string | null;

  @ManyToOne(() => PayPeriodEntity, { nullable: true })
  @JoinColumn({ name: 'applied_pay_period_id' })
  appliedPayPeriod: PayPeriodEntity | null;

  /** Loại: earning hoặc deduction */
  @Column({ type: 'enum', enum: PayComponentType })
  type: PayComponentType;

  /** Mô tả khoản điều chỉnh */
  @Column({ type: 'varchar', length: 255 })
  description: string;

  /** Số tiền điều chỉnh (dương = thêm, âm = trừ) */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  amount: number;

  /** Lý do điều chỉnh */
  @Column({ type: 'text' })
  reason: string;

  /** Đã áp dụng vào salary slip chưa */
  @Column({ name: 'is_applied', type: 'boolean', default: false })
  isApplied: boolean;

  /** Người duyệt adjustment */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;
}
