import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DepartmentEntity } from './entities/department.entity';
import { DepartmentQueryDto } from './dto/department-query.dto';

@Injectable()
export class DepartmentRepository {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly repo: Repository<DepartmentEntity>,
  ) {}

  async findAll(query: DepartmentQueryDto): Promise<[DepartmentEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('department')
      .where('department.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('department.schoolId = :schoolId', { schoolId });
    }

    if (search) {
      queryBuilder.andWhere('department.name ILIKE :search', { search: `%${search}%` });
    }

    if (sortBy) {
      queryBuilder.orderBy(`department.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('department.name', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<DepartmentEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true },
    });
  }

  async findBySchool(schoolId: string): Promise<DepartmentEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async create(data: Partial<DepartmentEntity>): Promise<DepartmentEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<DepartmentEntity>): Promise<DepartmentEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
