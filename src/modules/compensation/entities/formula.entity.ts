import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FormulaStatus } from '../enums';
import { PayComponentEntity } from './pay-component.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

@Entity('formulas')
export class FormulaEntity extends BaseEntity {
  @Column({ name: 'pay_component_id', type: 'uuid' })
  payComponentId: string;

  @ManyToOne(() => PayComponentEntity)
  @JoinColumn({ name: 'pay_component_id' })
  payComponent: PayComponentEntity;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ type: 'text' })
  expression: string;

  @Column({ name: 'parsed_ast', type: 'jsonb', nullable: true })
  parsedAst: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  dependencies: string[] | null;

  @Column({ name: 'variable_refs', type: 'jsonb', nullable: true })
  variableRefs: string[] | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'text', nullable: true })
  changelog: string | null;

  @Column({ type: 'enum', enum: FormulaStatus, default: FormulaStatus.DRAFT })
  status: FormulaStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
