import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { PayrollRunEntity } from './payroll-run.entity';
import { PayPeriodEntity } from './pay-period.entity';

/**
 * Snapshot đầu vào tại thời điểm tính lương.
 * Giúp audit + replay: biết chính xác input lúc tính.
 */
@Entity('payroll_input_snapshots')
@Index('idx_payroll_snapshots_school', ['schoolId', 'deletedAt'])
@Index('idx_payroll_snapshots_teacher_period', ['teacherId', 'payPeriodId'])
export class PayrollInputSnapshotEntity extends BaseEntity {
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

  @Column({ name: 'payroll_run_id', type: 'uuid', nullable: true })
  payrollRunId: string | null;

  @ManyToOne(() => PayrollRunEntity, { nullable: true })
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRunEntity | null;

  @Column({ name: 'pay_period_id', type: 'uuid' })
  payPeriodId: string;

  @ManyToOne(() => PayPeriodEntity)
  @JoinColumn({ name: 'pay_period_id' })
  payPeriod: PayPeriodEntity;

  @Column({ name: 'salary_slip_id', type: 'uuid', nullable: true })
  salarySlipId: string | null;

  /** Số ngày công thực tế */
  @Column({
    name: 'attendance_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  attendanceDays: number;

  /** Tiết dạy theo loại (jsonb) */
  @Column({ name: 'teaching_hours_by_type', type: 'jsonb', nullable: true })
  teachingHoursByType: Record<string, number> | null;

  /** Giá trị biến tại thời điểm tính (jsonb) */
  @Column({ name: 'variable_values', type: 'jsonb', nullable: true })
  variableValues: Record<string, number> | null;

  /** Phiên bản formula đã dùng (jsonb) */
  @Column({ name: 'formula_versions_used', type: 'jsonb', nullable: true })
  formulaVersionsUsed: Record<string, number> | null;
}
