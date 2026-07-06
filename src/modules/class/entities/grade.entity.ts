import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { ClassEntity } from './class.entity';

@Entity('grades')
export class GradeEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'varchar', length: 50 })
  name: string; // "Khối 10"

  @Column({ type: 'int' })
  level: number; // 10, 11, 12

  @OneToMany(() => ClassEntity, (cls) => cls.grade)
  classes: ClassEntity[];
}
