import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SchoolEntity } from './entities/school.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SchoolRepository {
  constructor(
    @InjectRepository(SchoolEntity)
    private readonly repo: Repository<SchoolEntity>,
  ) {}

  async findAll(pagination: PaginationDto): Promise<[SchoolEntity[], number]> {
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('school')
      .where('school.deletedAt IS NULL');

    if (sortBy) {
      queryBuilder.orderBy(`school.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('school.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<SchoolEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findByCode(code: string): Promise<SchoolEntity | null> {
    return this.repo.findOne({
      where: { code, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<SchoolEntity>): Promise<SchoolEntity> {
    const school = this.repo.create(data);
    return this.repo.save(school);
  }

  async update(
    id: string,
    data: Partial<SchoolEntity>,
  ): Promise<SchoolEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
