import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ApprovalAction } from '../enums';
import { SchoolEntity } from '../../school/entities/school.entity';
import { PayrollRunEntity } from './payroll-run.entity';

/**
 * Lịch sử phê duyệt Payroll Run.
 * Ghi lại mỗi lần thay đổi trạng thái (submit, review, approve, reject, paid).
 */
@Entity('payroll_approvals')
export class PayrollApprovalEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'payroll_run_id', type: 'uuid' })
  payrollRunId: string;

  @ManyToOne(() => PayrollRunEntity)
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRunEntity;

  /** Hành động (submit_for_review, review, approve, reject, mark_paid) */
  @Column({ type: 'enum', enum: ApprovalAction })
  action: ApprovalAction;

  /** Trạng thái trước khi thay đổi */
  @Column({ name: 'from_status', type: 'varchar', length: 20 })
  fromStatus: string;

  /** Trạng thái sau khi thay đổi */
  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus: string;

  /** Người thực hiện */
  @Column({ name: 'performed_by', type: 'uuid' })
  performedBy: string;

  /** Ghi chú / Lý do */
  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
