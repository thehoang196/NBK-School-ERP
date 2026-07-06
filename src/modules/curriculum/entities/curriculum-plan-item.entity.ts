import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CurriculumPlanEntity } from './curriculum-plan.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';

@Entity('curriculum_plan_items')
@Unique(['curriculumPlanId', 'subjectId'])
export class CurriculumPlanItemEntity extends BaseEntity {
  @Column({ name: 'curriculum_plan_id', type: 'uuid' })
  curriculumPlanId: string;

  @ManyToOne(() => CurriculumPlanEntity, (plan) => plan.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'curriculum_plan_id' })
  curriculumPlan: CurriculumPlanEntity;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity)
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity;

  @Column({ name: 'periods_per_week', type: 'int' })
  periodsPerWeek: number;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
