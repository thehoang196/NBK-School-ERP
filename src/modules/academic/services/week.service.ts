import { Injectable, NotFoundException } from '@nestjs/common';
import { WeekRepository } from '../repositories/week.repository';
import { SemesterRepository } from '../repositories/semester.repository';
import { WeekEntity } from '../entities/week.entity';
import { CreateWeekDto, WeekQueryDto } from '../dto/week';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class WeekService {
  constructor(
    private readonly weekRepository: WeekRepository,
    private readonly semesterRepository: SemesterRepository,
  ) {}

  async findAll(query: WeekQueryDto): Promise<PaginatedResponse<WeekEntity>> {
    const [data, total] = await this.weekRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách tuần thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<WeekEntity> {
    const week = await this.weekRepository.findById(id);
    if (!week) {
      throw new NotFoundException('Không tìm thấy tuần');
    }
    return week;
  }

  async findBySemester(semesterId: string): Promise<WeekEntity[]> {
    return this.weekRepository.findBySemester(semesterId);
  }

  async create(dto: CreateWeekDto): Promise<WeekEntity> {
    const semester = await this.semesterRepository.findById(dto.semesterId);
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    return this.weekRepository.create({
      semesterId: dto.semesterId,
      weekNumber: dto.weekNumber,
      startDate: dto.startDate,
      endDate: dto.endDate,
      note: dto.note ?? null,
      isHoliday: dto.isHoliday ?? false,
    });
  }

  async generateWeeks(semesterId: string): Promise<WeekEntity[]> {
    const semester = await this.semesterRepository.findById(semesterId);
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    // Xóa các tuần cũ của học kỳ trước khi sinh mới
    await this.weekRepository.softDeleteBySemester(semesterId);

    const weeks: Partial<WeekEntity>[] = [];
    const startDate = new Date(semester.startDate);
    const endDate = new Date(semester.endDate);
    let weekNumber = 1;
    let currentStart = new Date(startDate);

    while (currentStart <= endDate) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 6);

      // Nếu ngày cuối tuần vượt quá ngày kết thúc học kỳ, giới hạn lại
      const weekEnd = currentEnd > endDate ? endDate : currentEnd;

      weeks.push({
        semesterId,
        weekNumber,
        startDate: currentStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        isHoliday: false,
      });

      weekNumber++;
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    return this.weekRepository.createMany(weeks);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.weekRepository.softDelete(id);
  }
}
