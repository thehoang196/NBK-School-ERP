import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EventEntity } from './entities/event.entity';
import { EventQueryDto, CalendarQueryDto } from './dto/event-query.dto';

@Injectable()
export class EventRepository {
  constructor(
    @InjectRepository(EventEntity)
    private readonly repo: Repository<EventEntity>,
  ) {}

  async findAll(query: EventQueryDto): Promise<[EventEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, eventType, status, startFrom, startTo } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('event')
      .where('event.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('event.school_id = :schoolId', { schoolId });
    }

    if (eventType) {
      queryBuilder.andWhere('event.event_type = :eventType', { eventType });
    }

    if (status) {
      queryBuilder.andWhere('event.status = :status', { status });
    }

    if (startFrom) {
      queryBuilder.andWhere('event.start_date >= :startFrom', { startFrom });
    }

    if (startTo) {
      queryBuilder.andWhere('event.start_date <= :startTo', { startTo });
    }

    if (sortBy) {
      queryBuilder.orderBy(`event.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('event.start_date', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<EventEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true },
    });
  }

  async findByCalendar(query: CalendarQueryDto): Promise<EventEntity[]> {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const queryBuilder = this.repo.createQueryBuilder('event')
      .where('event.deletedAt IS NULL')
      .andWhere(
        '(event.start_date <= :endOfMonth AND event.end_date >= :startOfMonth)',
        { startOfMonth, endOfMonth },
      );

    if (query.schoolId) {
      queryBuilder.andWhere('event.school_id = :schoolId', { schoolId: query.schoolId });
    }

    queryBuilder.orderBy('event.start_date', 'ASC');

    return queryBuilder.getMany();
  }

  async findByDateRange(schoolId: string, startDate: Date, endDate: Date): Promise<EventEntity[]> {
    return this.repo.createQueryBuilder('event')
      .where('event.deletedAt IS NULL')
      .andWhere('event.school_id = :schoolId', { schoolId })
      .andWhere('event.affects_schedule = :affects', { affects: true })
      .andWhere(
        '(event.start_date <= :endDate AND event.end_date >= :startDate)',
        { startDate, endDate },
      )
      .getMany();
  }

  async create(data: Partial<EventEntity>): Promise<EventEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<EventEntity>): Promise<EventEntity | null> {
    const event = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!event) return null;

    Object.assign(event, data);
    await this.repo.save(event);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
