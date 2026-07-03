import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EntityStatus } from '../../../common/enums/status.enum';
import { PayComponentType } from '../enums';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('pay_components')
export class PayComponentEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: PayComponentType })
  type: PayComponentType;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_taxable', type: 'boolean', default: false })
  isTaxable: boolean;

  @Column({ name: 'is_insurance_applicable', type: 'boolean', default: false })
  isInsuranceApplicable: boolean;

  @Column({ name: 'is_statutory', type: 'boolean', default: false })
  isStatutory: boolean;

  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
}
