import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

/**
 * Bảng tổng hợp chấm công theo tháng.
 * Tính toán từ attendance_records, dùng làm input cho Formula Engine.
 * Output variables: NGAY_CONG, CONG_CHUAN, TANG_CA
 */
@Entity('attendance_summaries')
@Index('idx_attendance_summaries_school_deleted', ['schoolId', 'deletedAt'])
@Unique('uq_attendance_summary_teacher_period', [
  'schoolId',
  'teacherId',
  'month',
  'year',
])
export class AttendanceSummaryEntity extends BaseEntity {
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

  /** Tháng (1-12) */
  @Column({ type: 'smallint' })
  month: number;

  /** Năm */
  @Column({ type: 'smallint' })
  year: number;

  /** Số ngày công thực tế (NGAY_CONG) — tổng work_coefficient */
  @Column({
    name: 'actual_work_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  actualWorkDays: number;

  /** Công chuẩn trong tháng (CONG_CHUAN) — số ngày làm việc theo lịch */
  @Column({
    name: 'standard_work_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 22,
  })
  standardWorkDays: number;

  /** Tổng giờ tăng ca (TANG_CA) */
  @Column({
    name: 'total_overtime_hours',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  totalOvertimeHours: number;

  /** Số ngày nghỉ phép (có lương) */
  @Column({
    name: 'paid_leave_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  paidLeaveDays: number;

  /** Số ngày nghỉ không phép / không lương */
  @Column({
    name: 'unpaid_leave_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  unpaidLeaveDays: number;

  /** Số ngày đi muộn */
  @Column({ name: 'late_days', type: 'int', default: 0 })
  lateDays: number;

  /** Số ngày vắng không phép */
  @Column({ name: 'absent_days', type: 'int', default: 0 })
  absentDays: number;

  /** Trạng thái: đã chốt hay chưa */
  @Column({ name: 'is_finalized', type: 'boolean', default: false })
  isFinalized: boolean;
}
