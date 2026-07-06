import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DepartmentEntity } from './department.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { PositionTitle, ManagementLevel } from '../enums';

@Entity('department_members')
export class DepartmentMemberEntity extends BaseEntity {
  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => DepartmentEntity)
  @JoinColumn({ name: 'department_id' })
  department: DepartmentEntity;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacher_id' })
  teacher: TeacherEntity;

  @Column({
    name: 'position_title',
    type: 'enum',
    enum: PositionTitle,
    default: PositionTitle.GVBM,
  })
  positionTitle: PositionTitle;

  @Column({
    name: 'management_level',
    type: 'enum',
    enum: ManagementLevel,
    nullable: true,
  })
  managementLevel: ManagementLevel | null;
}
