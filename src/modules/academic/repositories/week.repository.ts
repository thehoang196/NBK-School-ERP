import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { WeekEntity } from '../entities/week.entity';
import { WeekQueryDto } from '../dto/week';
import { WeekType } from '../enums';

@Injectable()
export class WeekRepository {
  constructor(
    @InjectRepository(WeekEntity)
    private readonly repo: Repository<WeekEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: WeekQueryDto,
    schoolId: string,
  ): Promise<[WeekEntity[], number]> {
    const { page, limit, sortBy, sortOrder, semesterId, weekType } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('week')
      .where('week.deletedAt IS NULL')
      .andWhere('week.schoolId = :schoolId', { schoolId });

    if (semesterId) {
      queryBuilder.andWhere('week.semesterId = :semesterId', { semesterId });
    }

    if (weekType && weekType.length > 0) {
      queryBuilder.andWhere('week.weekType IN (:...weekTypes)', {
        weekTypes: weekType,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`week.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('week.weekNumber', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string, schoolId?: string): Promise<WeekEntity | null> {
    const where: Record<string, unknown> = { id, deletedAt: IsNull() };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    return this.repo.findOne({
      where: where as never,
      relations: { semester: true },
    });
  }

  async findBySemester(semesterId: string): Promise<WeekEntity[]> {
    return this.repo.find({
      where: { semesterId, deletedAt: IsNull() },
      order: { weekNumber: 'ASC' },
    });
  }

  /**
   * Find weeks by semester with optional weekType filter.
   * Returns weeks ordered by week_number ascending.
   */
  async findBySemesterWithFilters(
    semesterId: string,
    weekTypes?: WeekType[],
  ): Promise<WeekEntity[]> {
    const queryBuilder = this.repo
      .createQueryBuilder('week')
      .where('week.deletedAt IS NULL')
      .andWhere('week.semesterId = :semesterId', { semesterId });

    if (weekTypes && weekTypes.length > 0) {
      queryBuilder.andWhere('week.weekType IN (:...weekTypes)', { weekTypes });
    }

    queryBuilder.orderBy('week.weekNumber', 'ASC');

    return queryBuilder.getMany();
  }

  /**
   * Find weeks that overlap with a given date range within a semester.
   * Overlap condition: NOT (existing.end_date < newStart OR existing.start_date > newEnd)
   * Optionally exclude a specific week (for update scenarios).
   */
  async findOverlappingWeeks(
    semesterId: string,
    startDate: string,
    endDate: string,
    excludeWeekId?: string,
  ): Promise<WeekEntity[]> {
    const queryBuilder = this.repo
      .createQueryBuilder('week')
      .where('week.deletedAt IS NULL')
      .andWhere('week.semesterId = :semesterId', { semesterId })
      .andWhere('week.startDate <= :endDate', { endDate })
      .andWhere('week.endDate >= :startDate', { startDate });

    if (excludeWeekId) {
      queryBuilder.andWhere('week.id != :excludeWeekId', { excludeWeekId });
    }

    queryBuilder.orderBy('week.weekNumber', 'ASC');

    return queryBuilder.getMany();
  }

  /**
   * Get the next available week_number for a semester.
   * Returns MAX(week_number) + 1 for existing active weeks, or 1 if no weeks exist.
   */
  async getNextWeekNumber(semesterId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('week')
      .select('MAX(week.weekNumber)', 'maxWeekNumber')
      .where('week.deletedAt IS NULL')
      .andWhere('week.semesterId = :semesterId', { semesterId })
      .getRawOne();

    const maxWeekNumber = result?.maxWeekNumber;
    return maxWeekNumber ? maxWeekNumber + 1 : 1;
  }

  /**
   * Bulk update week_number values for reordering.
   * Accepts array of { id, weekNumber } pairs and updates atomically in a transaction.
   */
  async reorderWeeks(
    updates: { id: string; weekNumber: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;

    await this.dataSource.transaction(async (manager) => {
      for (const { id, weekNumber } of updates) {
        await manager.update(WeekEntity, id, { weekNumber });
      }
    });
  }

  /**
   * Count active (non-deleted) weeks for a semester.
   * Used by bulk generation validation to check if weeks already exist.
   */
  async countBySemester(semesterId: string): Promise<number> {
    return this.repo.count({
      where: { semesterId, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<WeekEntity>): Promise<WeekEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async bulkCreate(data: Partial<WeekEntity>[]): Promise<WeekEntity[]> {
    const entities = this.repo.create(data);
    return this.repo.save(entities);
  }

  async update(
    id: string,
    data: Partial<WeekEntity>,
  ): Promise<WeekEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async softDeleteBySemester(semesterId: string): Promise<void> {
    await this.repo.softDelete({ semesterId });
  }
}
