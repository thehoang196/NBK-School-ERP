import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { SubjectEntity } from './subject.entity';

@Entity('subject_groups')
@Unique(['schoolId', 'code'])
export class SubjectGroupEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'color_code', type: 'varchar', length: 7, nullable: true })
  colorCode: string | null;

  @OneToMany(() => SubjectEntity, (subject) => subject.subjectGroup)
  subjects: SubjectEntity[];
}
