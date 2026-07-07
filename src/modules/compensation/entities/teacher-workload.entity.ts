import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { PayPeriodEntity } from './pay-period.entity';

/**
 * Teacher Workload — tổng hợp khối lượng giảng dạy theo kỳ lương.
 * Được tính toán từ TeachingMetricsService sau khi tính lương.
 */
@Entity('teacher_workloads')
@Index('idx_teacher_workloads_school', ['schoolId', 'deletedAt'])
@Unique('uq_teacher_workload_teacher_period', ['teacherId', 'payPeriodId', 'schoolId'])
export class TeacherWorkloadEntity extends BaseEntity {
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

  @Column({ name: 'pay_period_id', type: 'uuid' })
  payPeriodId: string;

  @ManyToOne(() => PayPeriodEntity)
  @JoinColumn({ name: 'pay_period_id' })
  payPeriod: PayPeriodEntity;

  /** Tổng số tiết */
  @Column({ name: 'total_hours', type: 'int', default: 0 })
  totalHours: number;

  /** Phân tách theo loại hoạt động (jsonb) */
  @Column({ name: 'hours_by_type', type: 'jsonb', nullable: true })
  hoursByType: Record<string, number> | null;

  /** Phân tách theo môn học (jsonb) */
  @Column({ name: 'hours_by_subject', type: 'jsonb', nullable: true })
  hoursBySubject: Record<string, number> | null;
}
