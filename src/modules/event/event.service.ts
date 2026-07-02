import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventRepository } from './event.repository';
import { EventEntity } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto, CalendarQueryDto } from './dto/event-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async findAll(query: EventQueryDto): Promise<PaginatedResponse<EventEntity>> {
    const [data, total] = await this.eventRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách sự kiện thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<EventEntity> {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundException('Không tìm thấy sự kiện');
    }
    return event;
  }

  async getCalendar(query: CalendarQueryDto): Promise<EventEntity[]> {
    return this.eventRepository.findByCalendar(query);
  }

  async create(dto: CreateEventDto): Promise<EventEntity> {
    this.validateDateRange(dto.startDate, dto.endDate);

    const entity: Partial<EventEntity> = {
      schoolId: dto.schoolId,
      title: dto.title,
      description: dto.description ?? null,
      eventType: dto.eventType,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      allDay: dto.allDay ?? false,
      affectsSchedule: dto.affectsSchedule ?? false,
      isRecurring: dto.isRecurring ?? false,
      recurrenceRule: dto.recurrenceRule ?? null,
      affectedGrades: dto.affectedGrades ?? null,
      affectedClasses: dto.affectedClasses ?? null,
      status: dto.status,
    };

    return this.eventRepository.create(entity);
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventEntity> {
    const existing = await this.findById(id);

    const newStartDate = dto.startDate ?? existing.startDate.toISOString();
    const newEndDate = dto.endDate ?? existing.endDate.toISOString();
    this.validateDateRange(newStartDate, newEndDate);

    const updateData: Partial<EventEntity> = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description ?? null;
    if (dto.eventType !== undefined) updateData.eventType = dto.eventType;
    if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
    if (dto.allDay !== undefined) updateData.allDay = dto.allDay;
    if (dto.affectsSchedule !== undefined) updateData.affectsSchedule = dto.affectsSchedule;
    if (dto.isRecurring !== undefined) updateData.isRecurring = dto.isRecurring;
    if (dto.recurrenceRule !== undefined) updateData.recurrenceRule = dto.recurrenceRule ?? null;
    if (dto.affectedGrades !== undefined) updateData.affectedGrades = dto.affectedGrades ?? null;
    if (dto.affectedClasses !== undefined) updateData.affectedClasses = dto.affectedClasses ?? null;
    if (dto.status !== undefined) updateData.status = dto.status;

    const updated = await this.eventRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy sự kiện');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.eventRepository.softDelete(id);
  }

  /**
   * Lấy danh sách sự kiện ảnh hưởng TKB trong khoảng ngày
   * Dùng để tích hợp với module timetable khi cần hủy tiết
   */
  async findScheduleAffectingEvents(
    schoolId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<EventEntity[]> {
    return this.eventRepository.findByDateRange(schoolId, startDate, endDate);
  }

  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
    }
  }
}
