import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { PayrollAdjustmentEntity } from '../entities/payroll-adjustment.entity';

@Injectable()
export class PayrollAdjustmentRepository {
  constructor(
    @InjectRepository(PayrollAdjustmentEntity)
    private readonly repo: Repository<PayrollAdjustmentEntity>,
  ) {}

  async findAll(
    schoolId: string,
    options: { page: number; limit: number; teacherId?: string; payPeriodId?: string },
  ): Promise<[PayrollAdjustmentEntity[], number]> {
    const where: FindOptionsWhere<PayrollAdjustmentEntity> = {
      schoolId,
      deletedAt: IsNull(),
    };

    if (options.teacherId) {
      where.teacherId = options.teacherId;
    }
    if (options.payPeriodId) {
      where.originalPayPeriodId = options.payPeriodId;
    }

    return this.repo.findAndCount({
      where,
      relations: ['teacher', 'originalPayPeriod'],
      order: { createdAt: 'DESC' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  }

  async findById(id: string, schoolId: string): Promise<PayrollAdjustmentEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
      relations: ['teacher', 'originalPayPeriod'],
    });
  }

  async create(data: Partial<PayrollAdjustmentEntity>): Promise<PayrollAdjustmentEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<PayrollAdjustmentEntity>): Promise<void> {
    await this.repo.update(id, data);
  }

  async findUnappliedByPeriod(
    appliedPayPeriodId: string,
    schoolId: string,
  ): Promise<PayrollAdjustmentEntity[]> {
    return this.repo.find({
      where: {
        appliedPayPeriodId,
        schoolId,
        isApplied: false,
        deletedAt: IsNull(),
      },
    });
  }
}
