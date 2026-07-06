import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SessionEntity } from '../entities/session.entity';
import { SessionQueryDto } from '../dto/session';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly repo: Repository<SessionEntity>,
  ) {}

  async findAll(
    query: SessionQueryDto,
    schoolId: string,
  ): Promise<[SessionEntity[], number]> {
    const { page, limit, sortBy, sortOrder, campusId, gradeLevel, search } =
      query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('session')
      .where('session.deletedAt IS NULL')
      .andWhere('session.schoolId = :schoolId', { schoolId });

    if (campusId) {
      queryBuilder.andWhere('session.campusId = :campusId', { campusId });
    }

    if (gradeLevel) {
      queryBuilder.andWhere('session.gradeLevel = :gradeLevel', { gradeLevel });
    }

    if (search) {
      queryBuilder.andWhere('session.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`session.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('session.sortOrder', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string, schoolId?: string): Promise<SessionEntity | null> {
    const where: Record<string, unknown> = { id, deletedAt: IsNull() };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    return this.repo.findOne({
      where: where as never,
      relations: { school: true },
    });
  }

  async findBySchool(schoolId: string): Promise<SessionEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { sortOrder: 'ASC' },
    });
  }

  async create(data: Partial<SessionEntity>): Promise<SessionEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<SessionEntity>,
  ): Promise<SessionEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
