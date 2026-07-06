import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PayPeriodEntity } from '../entities/pay-period.entity';
import { PayPeriodQueryDto } from '../dto/pay-period/pay-period-query.dto';

@Injectable()
export class PayPeriodRepository {
  constructor(
    @InjectRepository(PayPeriodEntity)
    private readonly repo: Repository<PayPeriodEntity>,
  ) {}

  async findAll(
    query: PayPeriodQueryDto,
  ): Promise<[PayPeriodEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('pp')
      .where('pp.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('pp.schoolId = :schoolId', { schoolId });
    }

    if (status) {
      queryBuilder.andWhere('pp.status = :status', { status });
    }

    if (sortBy) {
      queryBuilder.orderBy(`pp.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('pp.startDate', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<PayPeriodEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findOverlapping(
    schoolId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<PayPeriodEntity[]> {
    const queryBuilder = this.repo
      .createQueryBuilder('pp')
      .where('pp.schoolId = :schoolId', { schoolId })
      .andWhere('pp.deletedAt IS NULL')
      .andWhere('pp.startDate <= :endDate', { endDate })
      .andWhere('pp.endDate >= :startDate', { startDate });

    if (excludeId) {
      queryBuilder.andWhere('pp.id != :excludeId', { excludeId });
    }

    return queryBuilder.getMany();
  }

  async create(data: Partial<PayPeriodEntity>): Promise<PayPeriodEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<PayPeriodEntity>,
  ): Promise<PayPeriodEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
