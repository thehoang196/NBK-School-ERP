import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FormulaEntity } from './formula.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { FormulaStatus } from '../enums';

/**
 * Formula Version History — append-only log of formula changes.
 * Mỗi lần update formula → tạo record mới ở đây.
 */
@Entity('formula_versions')
@Index('idx_formula_versions_formula', ['formulaId'])
@Index('idx_formula_versions_school', ['schoolId', 'deletedAt'])
export class FormulaVersionEntity extends BaseEntity {
  @Column({ name: 'formula_id', type: 'uuid' })
  formulaId: string;

  @ManyToOne(() => FormulaEntity)
  @JoinColumn({ name: 'formula_id' })
  formula: FormulaEntity;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'text' })
  expression: string;

  @Column({ name: 'parsed_ast', type: 'jsonb', nullable: true })
  parsedAst: Record<string, unknown> | null;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'text', nullable: true })
  changelog: string | null;

  @Column({ type: 'enum', enum: FormulaStatus, default: FormulaStatus.DRAFT })
  status: FormulaStatus;
}
