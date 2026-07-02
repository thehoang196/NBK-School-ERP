import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AcademicYearEntity } from '../entities/academic-year.entity';
import { AcademicYearQueryDto } from '../dto/academic-year';

@Injectable()
export class AcademicYearRepository {
  constructor(
    @InjectRepository(AcademicYearEntity)
    private readonly repo: Repository<AcademicYearEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: AcademicYearQueryDto): Promise<[AcademicYearEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('academicYear')
      .where('academicYear.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('academicYear.schoolId = :schoolId', { schoolId });
    }

    if (status) {
      queryBuilder.andWhere('academicYear.status = :status', { status });
    }

    if (sortBy) {
      queryBuilder.orderBy(`academicYear.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('academicYear.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<AcademicYearEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true },
    });
  }

  async findBySchool(schoolId: string): Promise<AcademicYearEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { startDate: 'DESC' },
    });
  }

  async create(data: Partial<AcademicYearEntity>): Promise<AcademicYearEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async createWithTransaction(data: Partial<AcademicYearEntity>): Promise<AcademicYearEntity> {
    return this.dataSource.transaction(async (manager) => {
      if (data.isCurrent) {
        await manager.update(
          AcademicYearEntity,
          { schoolId: data.schoolId, isCurrent: true },
          { isCurrent: false },
        );
      }
      const entity = manager.create(AcademicYearEntity, data);
      return manager.save(entity);
    });
  }

  async update(id: string, data: Partial<AcademicYearEntity>): Promise<AcademicYearEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (data.isCurrent) {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          AcademicYearEntity,
          { schoolId: existing.schoolId, isCurrent: true },
          { isCurrent: false },
        );
        await manager.update(AcademicYearEntity, id, data);
      });
    } else {
      await this.repo.update(id, data);
    }

    return this.findById(id);
  }

  async findOverlapping(
    schoolId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<AcademicYearEntity[]> {
    const queryBuilder = this.repo
      .createQueryBuilder('ay')
      .where('ay.schoolId = :schoolId', { schoolId })
      .andWhere('ay.deletedAt IS NULL')
      .andWhere('ay.startDate < :endDate', { endDate })
      .andWhere('ay.endDate > :startDate', { startDate });

    if (excludeId) {
      queryBuilder.andWhere('ay.id != :excludeId', { excludeId });
    }

    return queryBuilder.getMany();
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
