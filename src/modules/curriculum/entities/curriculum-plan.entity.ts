import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  VersionColumn,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { CurriculumPlanItemEntity } from './curriculum-plan-item.entity';

export enum CurriculumPlanStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('curriculum_plans')
@Unique(['schoolId', 'academicYearId', 'gradeId'])
export class CurriculumPlanEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @Column({ name: 'grade_id', type: 'uuid' })
  gradeId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: CurriculumPlanStatus,
    default: CurriculumPlanStatus.DRAFT,
  })
  status: CurriculumPlanStatus;

  @Column({ name: 'total_periods_per_week', type: 'int', default: 0 })
  totalPeriodsPerWeek: number;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @OneToMany(() => CurriculumPlanItemEntity, (item) => item.curriculumPlan, {
    cascade: true,
  })
  items: CurriculumPlanItemEntity[];
}
