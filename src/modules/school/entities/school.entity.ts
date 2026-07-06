import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolStatus } from '../../../common/enums/status.enum';

@Entity('schools')
export class SchoolEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({
    name: 'principal_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  principalName: string | null;

  @Column({ name: 'parent_school_id', type: 'uuid', nullable: true })
  parentSchoolId: string | null;

  @ManyToOne(() => SchoolEntity, (school) => school.childSchools, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_school_id' })
  parentSchool: SchoolEntity | null;

  @OneToMany(() => SchoolEntity, (school) => school.parentSchool)
  childSchools: SchoolEntity[];

  @Column({ type: 'enum', enum: SchoolStatus, default: SchoolStatus.ACTIVE })
  status: SchoolStatus;
}
