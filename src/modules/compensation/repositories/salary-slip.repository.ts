import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { SalarySlipStatus } from '../enums';

export interface SalarySlipQueryDto {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'ASC' | 'DESC';
  schoolId?: string;
  payPeriodId?: string;
  teacherId?: string;
  status?: SalarySlipStatus;
}

@Injectable()
export class SalarySlipRepository {
  constructor(
    @InjectRepository(SalarySlipEntity)
    private readonly repo: Repository<SalarySlipEntity>,
  ) {}

  async findAll(
    query: SalarySlipQueryDto,
  ): Promise<[SalarySlipEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      schoolId,
      payPeriodId,
      teacherId,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('ss')
      .where('ss.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('ss.schoolId = :schoolId', { schoolId });
    }

    if (payPeriodId) {
      queryBuilder.andWhere('ss.payPeriodId = :payPeriodId', { payPeriodId });
    }

    if (teacherId) {
      queryBuilder.andWhere('ss.teacherId = :teacherId', { teacherId });
    }

    if (status) {
      queryBuilder.andWhere('ss.status = :status', { status });
    }

    if (sortBy) {
      queryBuilder.orderBy(`ss.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('ss.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<SalarySlipEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findByTeacherAndPeriod(
    teacherId: string,
    payPeriodId: string,
  ): Promise<SalarySlipEntity | null> {
    return this.repo.findOne({
      where: { teacherId, payPeriodId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findConfirmedByTeacherAndPeriod(
    teacherId: string,
    payPeriodId: string,
  ): Promise<SalarySlipEntity | null> {
    return this.repo.findOne({
      where: {
        teacherId,
        payPeriodId,
        status: SalarySlipStatus.CONFIRMED,
        deletedAt: IsNull(),
      },
    });
  }

  async deleteDraftByTeacherAndPeriod(
    teacherId: string,
    payPeriodId: string,
  ): Promise<void> {
    await this.repo.softDelete({
      teacherId,
      payPeriodId,
      status: SalarySlipStatus.DRAFT,
    });
  }

  async create(data: Partial<SalarySlipEntity>): Promise<SalarySlipEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<SalarySlipEntity>,
  ): Promise<SalarySlipEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
