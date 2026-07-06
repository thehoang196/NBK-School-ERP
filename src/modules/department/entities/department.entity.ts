import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';

@Entity('departments')
export class DepartmentEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'head_teacher_id', type: 'uuid', nullable: true })
  headTeacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true })
  @JoinColumn({ name: 'head_teacher_id' })
  headTeacher: TeacherEntity | null;

  @OneToMany(() => TeacherEntity, (teacher) => teacher.department)
  teachers: TeacherEntity[];
}
