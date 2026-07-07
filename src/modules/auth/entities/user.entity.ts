import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';

@Entity('users')
@Index('idx_users_company_school_id', ['companySchoolId'], {
  where: '"company_school_id" IS NOT NULL',
})
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => SchoolEntity, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity | null;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher: TeacherEntity | null;

  @Column({ name: 'company_school_id', type: 'uuid', nullable: true })
  companySchoolId: string | null;

  @ManyToOne(() => SchoolEntity, { nullable: true })
  @JoinColumn({ name: 'company_school_id' })
  companySchool: SchoolEntity | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;
}
