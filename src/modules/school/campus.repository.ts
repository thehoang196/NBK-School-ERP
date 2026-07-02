import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CampusEntity } from './entities/campus.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class CampusRepository {
  constructor(
    @InjectRepository(CampusEntity)
    private readonly repo: Repository<CampusEntity>,
  ) {}

  async findAll(
    pagination: PaginationDto,
    schoolId?: string,
  ): Promise<[CampusEntity[], number]> {
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('campus')
      .where('campus.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('campus.school_id = :schoolId', { schoolId });
    }

    if (sortBy) {
      queryBuilder.orderBy(`campus.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('campus.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<CampusEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findByCode(
    code: string,
    schoolId: string,
  ): Promise<CampusEntity | null> {
    return this.repo.findOne({
      where: { code, schoolId, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<CampusEntity>): Promise<CampusEntity> {
    const campus = this.repo.create(data);
    return this.repo.save(campus);
  }

  async update(
    id: string,
    data: Partial<CampusEntity>,
  ): Promise<CampusEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
