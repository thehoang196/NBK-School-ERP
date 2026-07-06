import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PeriodSwapStatus } from '../enums';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

/**
 * Yêu cầu đổi tiết giữa 2 giáo viên.
 * Flow: GV A gửi yêu cầu → GV B đồng ý/từ chối → Admin duyệt → Áp dụng vào TKB
 */
@Entity('period_swaps')
@Index('idx_period_swaps_school_deleted', ['schoolId', 'deletedAt'])
@Index('idx_period_swaps_requester', ['requesterId', 'status'])
export class PeriodSwapEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  /** GV yêu cầu đổi */
  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'requester_id' })
  requester: TeacherEntity;

  /** GV được đề nghị đổi */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'target_id' })
  target: TeacherEntity;

  /** Ngày của tiết GV A muốn đổi */
  @Column({ name: 'requester_date', type: 'date' })
  requesterDate: string;

  /** Tiết/period order của GV A */
  @Column({ name: 'requester_period', type: 'int' })
  requesterPeriod: number;

  /** Ngày của tiết GV B (đổi sang) */
  @Column({ name: 'target_date', type: 'date' })
  targetDate: string;

  /** Tiết/period order của GV B */
  @Column({ name: 'target_period', type: 'int' })
  targetPeriod: number;

  /** Lý do đổi tiết */
  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: PeriodSwapStatus,
    default: PeriodSwapStatus.PENDING_TEACHER,
  })
  status: PeriodSwapStatus;

  /** GV target đồng ý chưa */
  @Column({ name: 'target_accepted_at', type: 'timestamp', nullable: true })
  targetAcceptedAt: Date | null;

  /** Admin duyệt */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  /** Lý do từ chối */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;
}
