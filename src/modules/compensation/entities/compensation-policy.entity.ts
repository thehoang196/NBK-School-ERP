import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EntityStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { CampusEntity } from '../../school/entities/campus.entity';

@Entity('compensation_policies')
export class CompensationPolicyEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'campus_id', type: 'uuid', nullable: true })
  campusId: string | null;

  @ManyToOne(() => CampusEntity, { nullable: true })
  @JoinColumn({ name: 'campus_id' })
  campus: CampusEntity | null;

  @Column({ name: 'school_level', type: 'varchar', length: 50, nullable: true })
  schoolLevel: string | null;

  @Column({ name: 'pay_component_ids', type: 'jsonb' })
  payComponentIds: string[];

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
}
