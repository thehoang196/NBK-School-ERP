import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectQueryDto } from './dto/subject-query.dto';

@Injectable()
export class SubjectRepository {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly repo: Repository<SubjectEntity>,
  ) {}

  async findAll(query: SubjectQueryDto): Promise<[SubjectEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, subjectType, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('subject')
      .where('subject.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('subject.schoolId = :schoolId', { schoolId });
    }

    if (subjectType) {
      queryBuilder.andWhere('subject.subjectType = :subjectType', { subjectType });
    }

    if (search) {
      queryBuilder.andWhere(
        '(subject.name ILIKE :search OR subject.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`subject.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('subject.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<SubjectEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true },
    });
  }

  async findByCode(schoolId: string, code: string): Promise<SubjectEntity | null> {
    return this.repo.findOne({
      where: { schoolId, code, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<SubjectEntity>): Promise<SubjectEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<SubjectEntity>): Promise<SubjectEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
