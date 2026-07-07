import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SubjectType, RoomType } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { SubjectGradeEntity } from './subject-grade.entity';
import { SubjectGroupEntity } from './subject-group.entity';

@Entity('subjects')
@Index('idx_subjects_school_deleted', ['schoolId', 'deletedAt'])
export class SubjectEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'subject_group_id', type: 'uuid', nullable: true })
  subjectGroupId: string | null;

  @ManyToOne(() => SubjectGroupEntity, (group) => group.subjects, { nullable: true })
  @JoinColumn({ name: 'subject_group_id' })
  subjectGroup: SubjectGroupEntity | null;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 10, nullable: true })
  shortName: string | null;

  @Column({
    name: 'subject_type',
    type: 'enum',
    enum: SubjectType,
    default: SubjectType.REQUIRED,
  })
  subjectType: SubjectType;

  @Column({ name: 'periods_per_week', type: 'int', default: 0 })
  periodsPerWeek: number;

  @Column({
    name: 'requires_room_type',
    type: 'enum',
    enum: RoomType,
    default: RoomType.STANDARD,
  })
  requiresRoomType: RoomType;

  @Column({ name: 'color_code', type: 'varchar', length: 7, nullable: true })
  colorCode: string | null;

  @Column({ name: 'is_double_period', type: 'boolean', default: false })
  isDoublePeriod: boolean;

  @OneToMany(() => SubjectGradeEntity, (subjectGrade) => subjectGrade.subject)
  subjectGrades: SubjectGradeEntity[];
}
