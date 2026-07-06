import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EmployeeMasterEntity } from './employee-master.entity';

@Entity('employee_audit_logs')
export class EmployeeAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_master_id', type: 'uuid' })
  employeeMasterId: string;

  @ManyToOne(() => EmployeeMasterEntity)
  @JoinColumn({ name: 'employee_master_id' })
  employeeMaster: EmployeeMasterEntity;

  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string;

  @Column({ name: 'old_value', type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 100 })
  changedBy: string;

  @Column({
    name: 'change_source',
    type: 'varchar',
    length: 50,
    default: 'manual',
  })
  changeSource: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
