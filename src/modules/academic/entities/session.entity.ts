import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { CampusEntity } from '../../school/entities/campus.entity';
import { PeriodDefinitionEntity } from './period-definition.entity';
import { GradeLevel } from '../enums';

@Entity('sessions')
export class SessionEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'campus_id', type: 'uuid', nullable: true })
  campusId: string | null;

  @ManyToOne(() => CampusEntity)
  @JoinColumn({ name: 'campus_id' })
  campus: CampusEntity;

  @Column({
    name: 'grade_level',
    type: 'enum',
    enum: GradeLevel,
    nullable: true,
  })
  gradeLevel: GradeLevel | null;

  @Column({ type: 'varchar', length: 50 })
  name: string; // "Sáng", "Chiều"

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => PeriodDefinitionEntity, (period) => period.session)
  periodDefinitions: PeriodDefinitionEntity[];
}
