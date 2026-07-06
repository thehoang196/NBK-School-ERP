import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeAuditLogEntity } from '../entities/employee-audit-log.entity';

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(EmployeeAuditLogEntity)
    private readonly repo: Repository<EmployeeAuditLogEntity>,
  ) {}

  async create(
    data: Partial<EmployeeAuditLogEntity>,
  ): Promise<EmployeeAuditLogEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async createMany(
    data: Partial<EmployeeAuditLogEntity>[],
  ): Promise<EmployeeAuditLogEntity[]> {
    const entities = this.repo.create(data);
    return this.repo.save(entities);
  }

  async findByEmployeeId(
    employeeMasterId: string,
  ): Promise<EmployeeAuditLogEntity[]> {
    return this.repo.find({
      where: { employeeMasterId },
      order: { changedAt: 'DESC' },
    });
  }
}
