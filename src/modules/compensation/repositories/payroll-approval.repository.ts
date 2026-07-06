import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PayrollApprovalEntity } from '../entities/payroll-approval.entity';

@Injectable()
export class PayrollApprovalRepository {
  constructor(
    @InjectRepository(PayrollApprovalEntity)
    private readonly repo: Repository<PayrollApprovalEntity>,
  ) {}

  async findByPayrollRun(
    payrollRunId: string,
  ): Promise<PayrollApprovalEntity[]> {
    return this.repo.find({
      where: { payrollRunId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  async create(data: Partial<PayrollApprovalEntity>): Promise<PayrollApprovalEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }
}
