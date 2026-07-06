import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SchoolEntity } from '../../school/entities/school.entity';

/**
 * Entity target mà template áp dụng.
 */
export enum ExportEntityTarget {
  TEACHER = 'teacher',
  SUBJECT = 'subject',
  CLASS = 'class',
  DEPARTMENT = 'department',
  TEACHING_ASSIGNMENT = 'teaching_assignment',
}

/**
 * Cấu hình một cột trong template export.
 */
export interface ExportFieldMapping {
  /** Field name trong entity/DB (e.g., 'employeeCode', 'fullName') */
  dbField: string;
  /** Tên hiển thị trên header (e.g., 'Mã NV', 'Họ và Tên') */
  displayName: string;
  /** Độ rộng cột (Excel) */
  width: number;
  /** Transform function name (optional): 'date', 'enum_vi', 'boolean_vi' */
  transform?: string;
  /** Custom format string (optional) */
  format?: string;
}

@Entity('export_templates')
export class ExportTemplateEntity extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => SchoolEntity)
  @JoinColumn({ name: 'school_id' })
  school: SchoolEntity;

  @Column({ name: 'entity_target', type: 'enum', enum: ExportEntityTarget })
  entityTarget: ExportEntityTarget;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'field_mappings', type: 'jsonb' })
  fieldMappings: ExportFieldMapping[];

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}
