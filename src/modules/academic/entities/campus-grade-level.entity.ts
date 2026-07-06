import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CampusEntity } from '../../school/entities/campus.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { GradeLevel } from '../enums';

@Entity('campus_grade_levels')
export class CampusGradeLevelEntity extends BaseEntity {
  @Column({ name: 'campus_id', type: 'uuid' })
  campusId: string;

  @ManyToOne(() => CampusEntity)
  @JoinColumn({ name: 'campus_id' })
  campus: CampusEntity;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'grade_level', type: 'enum', enum: GradeLevel })
  gradeLevel: GradeLevel;
}
