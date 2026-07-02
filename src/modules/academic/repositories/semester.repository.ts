import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SemesterEntity } from '../entities/semester.entity';
import { SemesterQueryDto } from '../dto/semester';

@Injectable()
export class SemesterRepository {
  constructor(
    @InjectRepository(SemesterEntity)
    private readonly repo: Repository<SemesterEntity>,
  ) {}

  async findAll(query: SemesterQueryDto): Promise<[SemesterEntity[], number]> {
    const { page, limit, sortBy, sortOrder, academicYearId, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('semester')
      .where('semester.deletedAt IS NULL');

    if (academicYearId) {
      queryBuilder.andWhere('semester.academicYearId = :academicYearId', { academicYearId });
    }

    if (status) {
      queryBuilder.andWhere('semester.status = :status', { status });
    }

    if (sortBy) {
      queryBuilder.orderBy(`semester.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('semester.semesterNumber', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<SemesterEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { academicYear: true },
    });
  }

  async findByAcademicYear(academicYearId: string): Promise<SemesterEntity[]> {
    return this.repo.find({
      where: { academicYearId, deletedAt: IsNull() },
      order: { semesterNumber: 'ASC' },
    });
  }

  async create(data: Partial<SemesterEntity>): Promise<SemesterEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<SemesterEntity>): Promise<SemesterEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
