import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { DepartmentEntity } from './entities/department.entity';
import { DepartmentMemberEntity } from './entities/department-member.entity';
import { DepartmentQueryDto } from './dto/department-query.dto';

@Injectable()
export class DepartmentRepository {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly repo: Repository<DepartmentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: DepartmentQueryDto,
  ): Promise<[DepartmentEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('department')
      .where('department.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('department.schoolId = :schoolId', { schoolId });
    }

    if (search) {
      queryBuilder.andWhere('department.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`department.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('department.name', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(
    id: string,
    schoolId?: string,
  ): Promise<DepartmentEntity | null> {
    const where: Record<string, unknown> = { id, deletedAt: IsNull() };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    return this.repo.findOne({
      where,
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

  async update(
    id: string,
    data: Partial<DepartmentEntity>,
  ): Promise<DepartmentEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async findByNameAndSchool(
    name: string,
    schoolId: string,
    excludeId?: string,
  ): Promise<DepartmentEntity | null> {
    const queryBuilder = this.repo
      .createQueryBuilder('department')
      .where('LOWER(department.name) = LOWER(:name)', { name })
      .andWhere('department.schoolId = :schoolId', { schoolId })
      .andWhere('department.deletedAt IS NULL');

    if (excludeId) {
      queryBuilder.andWhere('department.id != :excludeId', { excludeId });
    }

    return queryBuilder.getOne();
  }

  async countActiveMembers(departmentId: string): Promise<number> {
    const memberRepo = this.dataSource.getRepository(DepartmentMemberEntity);
    return memberRepo.count({
      where: { departmentId, deletedAt: IsNull() },
    });
  }

  /**
   * Find departments by a list of IDs with pagination and filtering.
   * Used for Teacher role — only returns departments the teacher belongs to.
   */
  async findAllByIds(
    ids: string[],
    query: DepartmentQueryDto,
  ): Promise<[DepartmentEntity[], number]> {
    if (ids.length === 0) {
      return [[], 0];
    }

    const { page, limit, sortBy, sortOrder, schoolId, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('department')
      .where('department.deletedAt IS NULL')
      .andWhere('department.id IN (:...ids)', { ids });

    if (schoolId) {
      queryBuilder.andWhere('department.schoolId = :schoolId', { schoolId });
    }

    if (search) {
      queryBuilder.andWhere('department.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`department.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('department.name', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }
}
