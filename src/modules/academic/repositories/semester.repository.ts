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

  async findAll(
    schoolId: string,
    query: SemesterQueryDto,
  ): Promise<[SemesterEntity[], number]> {
    const { page, limit, sortBy, sortOrder, academicYearId, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('semester')
      .innerJoin('semester.academicYear', 'academicYear')
      .where('semester.deletedAt IS NULL')
      .andWhere('academicYear.deletedAt IS NULL');

    // SUPER_ADMIN: schoolId rỗng → không filter, trả tất cả
    if (schoolId) {
      queryBuilder.andWhere('academicYear.schoolId = :schoolId', { schoolId });
    }

    if (academicYearId) {
      queryBuilder.andWhere('semester.academicYearId = :academicYearId', {
        academicYearId,
      });
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

  async findById(
    id: string,
    schoolId?: string,
  ): Promise<SemesterEntity | null> {
    if (schoolId) {
      return this.repo
        .createQueryBuilder('semester')
        .innerJoinAndSelect('semester.academicYear', 'academicYear')
        .where('semester.id = :id', { id })
        .andWhere('semester.deletedAt IS NULL')
        .andWhere('academicYear.schoolId = :schoolId', { schoolId })
        .andWhere('academicYear.deletedAt IS NULL')
        .getOne();
    }

    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { academicYear: true },
    });
  }

  async findByAcademicYear(
    academicYearId: string,
    schoolId?: string,
  ): Promise<SemesterEntity[]> {
    if (schoolId) {
      return this.repo
        .createQueryBuilder('semester')
        .innerJoin('semester.academicYear', 'academicYear')
        .where('semester.academicYearId = :academicYearId', { academicYearId })
        .andWhere('semester.deletedAt IS NULL')
        .andWhere('academicYear.schoolId = :schoolId', { schoolId })
        .andWhere('academicYear.deletedAt IS NULL')
        .orderBy('semester.semesterNumber', 'ASC')
        .getMany();
    }

    return this.repo.find({
      where: { academicYearId, deletedAt: IsNull() },
      order: { semesterNumber: 'ASC' },
    });
  }

  async create(data: Partial<SemesterEntity>): Promise<SemesterEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<SemesterEntity>,
  ): Promise<SemesterEntity | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { academicYear: true },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
