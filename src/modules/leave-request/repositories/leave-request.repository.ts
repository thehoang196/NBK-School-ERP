import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { LeaveRequestEntity } from '../entities/leave-request.entity';
import { LeaveRequestQueryDto } from '../dto/leave-request-query.dto';

@Injectable()
export class LeaveRequestRepository {
  constructor(
    @InjectRepository(LeaveRequestEntity)
    private readonly repo: Repository<LeaveRequestEntity>,
  ) {}

  async findAll(
    schoolId: string,
    query: LeaveRequestQueryDto,
  ): Promise<[LeaveRequestEntity[], number]> {
    const where: FindOptionsWhere<LeaveRequestEntity> = {
      schoolId,
      deletedAt: IsNull(),
    };

    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.status) where.status = query.status;
    if (query.leaveType) where.leaveType = query.leaveType;
    if (query.fromDate) {
      where.startDate = MoreThanOrEqual(query.fromDate) as unknown as string;
    }
    if (query.toDate) {
      where.endDate = LessThanOrEqual(query.toDate) as unknown as string;
    }

    return this.repo.findAndCount({
      where,
      relations: ['teacher'],
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  async findById(id: string, schoolId: string): Promise<LeaveRequestEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
      relations: ['teacher'],
    });
  }

  async findByTeacherAndDateRange(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
  ): Promise<LeaveRequestEntity[]> {
    return this.repo
      .createQueryBuilder('lr')
      .where('lr.teacherId = :teacherId', { teacherId })
      .andWhere('lr.schoolId = :schoolId', { schoolId })
      .andWhere('lr.deletedAt IS NULL')
      .andWhere('lr.startDate <= :endDate', { endDate })
      .andWhere('lr.endDate >= :startDate', { startDate })
      .andWhere("lr.status != 'cancelled'")
      .andWhere("lr.status != 'rejected'")
      .getMany();
  }

  async create(data: Partial<LeaveRequestEntity>): Promise<LeaveRequestEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<LeaveRequestEntity>): Promise<void> {
    await this.repo.update(id, data);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
