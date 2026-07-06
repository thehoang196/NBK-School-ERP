import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { PayrollRunEntity } from '../entities/payroll-run.entity';
import { PayrollRunStatus } from '../enums';

@Injectable()
export class PayrollRunRepository {
  constructor(
    @InjectRepository(PayrollRunEntity)
    private readonly repo: Repository<PayrollRunEntity>,
  ) {}

  async findAll(
    schoolId: string,
    options: { page: number; limit: number; payPeriodId?: string; status?: PayrollRunStatus },
  ): Promise<[PayrollRunEntity[], number]> {
    const where: FindOptionsWhere<PayrollRunEntity> = {
      schoolId,
      deletedAt: IsNull(),
    };

    if (options.payPeriodId) {
      where.payPeriodId = options.payPeriodId;
    }
    if (options.status) {
      where.status = options.status;
    }

    return this.repo.findAndCount({
      where,
      relations: ['payPeriod'],
      order: { createdAt: 'DESC' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  }

  async findById(id: string, schoolId: string): Promise<PayrollRunEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
      relations: ['payPeriod'],
    });
  }

  async create(data: Partial<PayrollRunEntity>): Promise<PayrollRunEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<PayrollRunEntity>): Promise<void> {
    await this.repo.update(id, data);
  }
}
