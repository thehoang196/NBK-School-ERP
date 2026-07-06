import { Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../entities/base.entity';
import { SchoolEntity } from '../../modules/school/entities/school.entity';

@Index('idx_school_id', ['schoolId'])
export abstract class TenantBaseEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @ManyToOne(() => SchoolEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'school_id' })
  schoolId: string;
}
