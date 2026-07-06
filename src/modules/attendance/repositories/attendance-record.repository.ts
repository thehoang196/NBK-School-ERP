import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between, FindOptionsWhere } from 'typeorm';
import { AttendanceRecordEntity } from '../entities/attendance-record.entity';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';

@Injectable()
export class AttendanceRecordRepository {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly repo: Repository<AttendanceRecordEntity>,
  ) {}

  async findAll(
    schoolId: string,
    query: AttendanceQueryDto,
  ): Promise<[AttendanceRecordEntity[], number]> {
    const where: FindOptionsWhere<AttendanceRecordEntity> = {
      schoolId,
      deletedAt: IsNull(),
    };

    if (query.teacherId) {
      where.teacherId = query.teacherId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.fromDate && query.toDate) {
      where.workDate = Between(query.fromDate, query.toDate) as unknown as string;
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      relations: ['teacher'],
      order: { workDate: 'DESC', createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return [items, total];
  }

  async findById(
    id: string,
    schoolId: string,
  ): Promise<AttendanceRecordEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
      relations: ['teacher'],
    });
  }

  async findByTeacherAndDate(
    teacherId: string,
    workDate: string,
    schoolId: string,
  ): Promise<AttendanceRecordEntity | null> {
    return this.repo.findOne({
      where: { teacherId, workDate, schoolId, deletedAt: IsNull() },
    });
  }

  async findByTeacherAndDateRange(
    teacherId: string,
    startDate: string,
    endDate: string,
    schoolId: string,
  ): Promise<AttendanceRecordEntity[]> {
    return this.repo.find({
      where: {
        teacherId,
        schoolId,
        workDate: Between(startDate, endDate) as unknown as string,
        deletedAt: IsNull(),
      },
      order: { workDate: 'ASC' },
    });
  }

  async findBySchoolAndDateRange(
    schoolId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceRecordEntity[]> {
    return this.repo.find({
      where: {
        schoolId,
        workDate: Between(startDate, endDate) as unknown as string,
        deletedAt: IsNull(),
      },
      order: { teacherId: 'ASC', workDate: 'ASC' },
    });
  }

  async create(
    data: Partial<AttendanceRecordEntity>,
  ): Promise<AttendanceRecordEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async createMany(
    data: Partial<AttendanceRecordEntity>[],
  ): Promise<AttendanceRecordEntity[]> {
    const entities = this.repo.create(data);
    return this.repo.save(entities);
  }

  async update(
    id: string,
    data: Partial<AttendanceRecordEntity>,
  ): Promise<void> {
    await this.repo.update(id, data);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
