import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { AttendanceSummaryEntity } from '../entities/attendance-summary.entity';
import { AttendanceSummaryQueryDto } from '../dto/attendance-summary-query.dto';

@Injectable()
export class AttendanceSummaryRepository {
  constructor(
    @InjectRepository(AttendanceSummaryEntity)
    private readonly repo: Repository<AttendanceSummaryEntity>,
  ) {}

  async findAll(
    schoolId: string,
    query: AttendanceSummaryQueryDto,
  ): Promise<[AttendanceSummaryEntity[], number]> {
    const where: FindOptionsWhere<AttendanceSummaryEntity> = {
      schoolId,
      month: query.month,
      year: query.year,
      deletedAt: IsNull(),
    };

    if (query.teacherId) {
      where.teacherId = query.teacherId;
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      relations: ['teacher'],
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return [items, total];
  }

  async findByTeacher(
    teacherId: string,
    schoolId: string,
    month: number,
    year: number,
  ): Promise<AttendanceSummaryEntity | null> {
    return this.repo.findOne({
      where: { teacherId, schoolId, month, year, deletedAt: IsNull() },
    });
  }

  async upsert(data: Partial<AttendanceSummaryEntity>): Promise<AttendanceSummaryEntity> {
    const existing = await this.repo.findOne({
      where: {
        schoolId: data.schoolId!,
        teacherId: data.teacherId!,
        month: data.month!,
        year: data.year!,
        deletedAt: IsNull(),
      },
    });

    if (existing) {
      await this.repo.update(existing.id, data);
      return { ...existing, ...data } as AttendanceSummaryEntity;
    }

    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async finalize(id: string): Promise<void> {
    await this.repo.update(id, { isFinalized: true });
  }
}
