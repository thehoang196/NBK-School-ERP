import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({
      where: { email, deletedAt: IsNull() },
    });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findAll(
    pagination: PaginationDto,
    schoolId?: string,
  ): Promise<[UserEntity[], number]> {
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('user.school_id = :schoolId', { schoolId });
    }

    if (sortBy) {
      queryBuilder.orderBy(`user.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('user.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findAllFiltered(
    query: UserQueryDto,
  ): Promise<[UserEntity[], number]> {
    const { page, limit, sortBy, sortOrder, search, role, schoolId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('user.school_id = :schoolId', { schoolId });
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`user.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('user.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async create(data: Partial<UserEntity>): Promise<UserEntity> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async update(
    id: string,
    data: Partial<UserEntity>,
  ): Promise<UserEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
