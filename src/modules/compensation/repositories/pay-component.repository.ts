import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PayComponentEntity } from '../entities/pay-component.entity';
import { PayComponentQueryDto } from '../dto/pay-component/pay-component-query.dto';

@Injectable()
export class PayComponentRepository {
  constructor(
    @InjectRepository(PayComponentEntity)
    private readonly repo: Repository<PayComponentEntity>,
  ) {}

  async findAll(query: PayComponentQueryDto): Promise<[PayComponentEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, type, status, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('pc')
      .where('pc.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('pc.schoolId = :schoolId', { schoolId });
    }

    if (type) {
      queryBuilder.andWhere('pc.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('pc.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(pc.name ILIKE :search OR pc.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`pc.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('pc.sortOrder', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<PayComponentEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findByCode(code: string, schoolId: string): Promise<PayComponentEntity | null> {
    return this.repo.findOne({
      where: { code, schoolId, deletedAt: IsNull() },
    });
  }

  async findByIds(ids: string[]): Promise<PayComponentEntity[]> {
    if (ids.length === 0) return [];
    return this.repo.createQueryBuilder('pc')
      .where('pc.id IN (:...ids)', { ids })
      .andWhere('pc.deletedAt IS NULL')
      .getMany();
  }

  async create(data: Partial<PayComponentEntity>): Promise<PayComponentEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<PayComponentEntity>): Promise<PayComponentEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
