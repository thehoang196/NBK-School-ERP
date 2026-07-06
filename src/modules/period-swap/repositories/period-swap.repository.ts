import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere, In } from 'typeorm';
import { PeriodSwapEntity } from '../entities/period-swap.entity';
import { PeriodSwapStatus } from '../enums';

@Injectable()
export class PeriodSwapRepository {
  constructor(
    @InjectRepository(PeriodSwapEntity)
    private readonly repo: Repository<PeriodSwapEntity>,
  ) {}

  async findAll(
    schoolId: string,
    options: { page: number; limit: number; teacherId?: string; status?: PeriodSwapStatus },
  ): Promise<[PeriodSwapEntity[], number]> {
    const qb = this.repo
      .createQueryBuilder('ps')
      .leftJoinAndSelect('ps.requester', 'requester')
      .leftJoinAndSelect('ps.target', 'target')
      .where('ps.schoolId = :schoolId', { schoolId })
      .andWhere('ps.deletedAt IS NULL')
      .orderBy('ps.createdAt', 'DESC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);

    if (options.teacherId) {
      qb.andWhere('(ps.requesterId = :tid OR ps.targetId = :tid)', {
        tid: options.teacherId,
      });
    }

    if (options.status) {
      qb.andWhere('ps.status = :status', { status: options.status });
    }

    return qb.getManyAndCount();
  }

  async findById(id: string, schoolId: string): Promise<PeriodSwapEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
      relations: ['requester', 'target'],
    });
  }

  async create(data: Partial<PeriodSwapEntity>): Promise<PeriodSwapEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<PeriodSwapEntity>): Promise<void> {
    await this.repo.update(id, data);
  }
}
