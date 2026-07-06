import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AttendanceStatus, AttendanceMethod, LeaveType } from '../enums';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('attendance_records')
@Index('idx_attendance_records_school_deleted', ['schoolId', 'deletedAt'])
@Index('idx_attendance_records_teacher_date', ['teacherId', 'workDate'])
@Index('idx_attendance_records_school_date', ['schoolId', 'workDate'])
export class AttendanceRecordEntity extends BaseEntity {
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

  /** Ngày công (YYYY-MM-DD) */
  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  /** Giờ vào (nullable nếu chấm công thủ công chỉ ghi trạng thái) */
  @Column({ name: 'check_in', type: 'time', nullable: true })
  checkIn: string | null;

  /** Giờ ra */
  @Column({ name: 'check_out', type: 'time', nullable: true })
  checkOut: string | null;

  /** Trạng thái chấm công */
  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  /** Phương thức chấm công */
  @Column({
    type: 'enum',
    enum: AttendanceMethod,
    default: AttendanceMethod.MANUAL,
  })
  method: AttendanceMethod;

  /** Loại nghỉ (chỉ khi status = LEAVE hoặc ABSENT) */
  @Column({ name: 'leave_type', type: 'enum', enum: LeaveType, nullable: true })
  leaveType: LeaveType | null;

  /** Số giờ tăng ca trong ngày */
  @Column({
    name: 'overtime_hours',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 0,
  })
  overtimeHours: number;

  /** Hệ số ngày công (1 = full, 0.5 = nửa ngày, 0 = vắng) */
  @Column({
    name: 'work_coefficient',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 1,
  })
  workCoefficient: number;

  /** Ghi chú */
  @Column({ type: 'text', nullable: true })
  note: string | null;
}
