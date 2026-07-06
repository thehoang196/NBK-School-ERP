import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveRequestStatus, LeaveRequestType } from '../enums';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('leave_requests')
@Index('idx_leave_requests_school_deleted', ['schoolId', 'deletedAt'])
@Index('idx_leave_requests_teacher_status', ['teacherId', 'status'])
export class LeaveRequestEntity extends BaseEntity {
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

  /** Loại nghỉ */
  @Column({ name: 'leave_type', type: 'enum', enum: LeaveRequestType })
  leaveType: LeaveRequestType;

  /** Ngày bắt đầu nghỉ */
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  /** Ngày kết thúc nghỉ */
  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  /** Số ngày nghỉ (tính cả nửa ngày: 0.5) */
  @Column({
    name: 'total_days',
    type: 'decimal',
    precision: 4,
    scale: 1,
    default: 1,
  })
  totalDays: number;

  /** Lý do nghỉ */
  @Column({ type: 'text' })
  reason: string;

  /** Trạng thái */
  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  status: LeaveRequestStatus;

  /** Người duyệt */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  /** Lý do từ chối */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  /** Ghi chú của admin */
  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;
}
