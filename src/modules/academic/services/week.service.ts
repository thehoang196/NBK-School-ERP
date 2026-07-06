import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WeekRepository } from '../repositories/week.repository';
import { SemesterRepository } from '../repositories/semester.repository';
import { WeekEntity } from '../entities/week.entity';
import {
  CreateWeekDto,
  UpdateWeekDto,
  WeekQueryDto,
  ReorderWeeksDto,
} from '../dto/week';
import { BulkGenerateResultDto } from '../dto/week/bulk-generate-result.dto';
import { WeekType } from '../enums';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import {
  InvalidDateRangeException,
  WeekOutOfRangeException,
  WeekOverlapException,
  BulkGenerationConflictException,
} from '../exceptions';

@Injectable()
export class WeekService {
  constructor(
    private readonly weekRepository: WeekRepository,
    private readonly semesterRepository: SemesterRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: WeekQueryDto,
    schoolId: string,
  ): Promise<PaginatedResponse<WeekEntity>> {
    const [data, total] = await this.weekRepository.findAll(query, schoolId);
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

  async findById(id: string, schoolId?: string): Promise<WeekEntity> {
    const week = await this.weekRepository.findById(id, schoolId);
    if (!week) {
      throw new NotFoundException('Không tìm thấy tuần');
    }
    return week;
  }

  async findBySemester(semesterId: string): Promise<WeekEntity[]> {
    return this.weekRepository.findBySemester(semesterId);
  }

  async create(dto: CreateWeekDto, schoolId: string): Promise<WeekEntity> {
    const semester = await this.semesterRepository.findById(dto.semesterId);
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    // Validation 1: start_date <= end_date
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new InvalidDateRangeException();
    }

    // Validation 2: week dates within semester date range
    const semesterStart = new Date(semester.startDate);
    const semesterEnd = new Date(semester.endDate);
    if (startDate < semesterStart || endDate > semesterEnd) {
      throw new WeekOutOfRangeException();
    }

    // Validation 3: no overlapping weeks in the same semester
    const overlapping = await this.weekRepository.findOverlappingWeeks(
      dto.semesterId,
      dto.startDate,
      dto.endDate,
    );
    if (overlapping.length > 0) {
      throw new WeekOverlapException();
    }

    // Auto-assign weekNumber if not provided
    let weekNumber = dto.weekNumber;
    if (!weekNumber) {
      weekNumber = await this.weekRepository.getNextWeekNumber(dto.semesterId);
    }

    return this.weekRepository.create({
      semesterId: dto.semesterId,
      schoolId,
      weekNumber,
      startDate: dto.startDate,
      endDate: dto.endDate,
      note: dto.note ?? null,
      weekType: dto.weekType ?? WeekType.REGULAR,
      isHoliday: (dto.weekType ?? WeekType.REGULAR) === WeekType.HOLIDAY,
    });
  }

  async update(
    id: string,
    dto: UpdateWeekDto,
    schoolId: string,
  ): Promise<WeekEntity> {
    const existing = await this.weekRepository.findById(id, schoolId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tuần');
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : new Date(existing.startDate);
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : new Date(existing.endDate);

    // Validation 1: startDate <= endDate
    if (startDate > endDate) {
      throw new InvalidDateRangeException();
    }

    // Validation 2: week dates within semester date range
    if (dto.startDate || dto.endDate) {
      const semester = await this.semesterRepository.findById(
        existing.semesterId,
      );
      if (!semester) {
        throw new NotFoundException('Không tìm thấy học kỳ');
      }

      const semesterStart = new Date(semester.startDate);
      const semesterEnd = new Date(semester.endDate);
      if (startDate < semesterStart || endDate > semesterEnd) {
        throw new WeekOutOfRangeException();
      }

      // Validation 3: no overlapping weeks (exclude current)
      const overlapping = await this.weekRepository.findOverlappingWeeks(
        existing.semesterId,
        this.formatDate(startDate),
        this.formatDate(endDate),
        id,
      );
      if (overlapping.length > 0) {
        throw new WeekOverlapException();
      }
    }

    // Sync isHoliday with weekType if weekType is being updated
    const updateData: Partial<WeekEntity> = {};
    if (dto.startDate) updateData.startDate = dto.startDate;
    if (dto.endDate) updateData.endDate = dto.endDate;
    if (dto.weekNumber !== undefined) updateData.weekNumber = dto.weekNumber;
    if (dto.note !== undefined) updateData.note = dto.note ?? null;
    if (dto.weekType !== undefined) {
      updateData.weekType = dto.weekType;
      updateData.isHoliday = dto.weekType === WeekType.HOLIDAY;
    }
    if (dto.isHoliday !== undefined) {
      updateData.isHoliday = dto.isHoliday;
    }

    const updated = await this.weekRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tuần');
    }
    return updated;
  }

  async bulkGenerate(
    semesterId: string,
    schoolId: string,
  ): Promise<BulkGenerateResultDto> {
    const semester = await this.semesterRepository.findById(semesterId);
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    // Check if weeks already exist for this semester
    const existingCount = await this.weekRepository.countBySemester(semesterId);
    if (existingCount > 0) {
      throw new BulkGenerationConflictException();
    }

    // Generate weeks covering the full semester date range
    const weekData: Partial<WeekEntity>[] = [];
    const semesterStart = new Date(semester.startDate);
    const semesterEnd = new Date(semester.endDate);
    let weekNumber = 1;
    let currentStart = new Date(semesterStart);

    while (currentStart <= semesterEnd) {
      let currentEnd: Date;

      if (weekNumber === 1) {
        // First week: starts on semester start date, ends on next Sunday
        const dayOfWeek = currentStart.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + daysUntilSunday);
      } else {
        // Internal weeks: Monday to Sunday (7 days)
        currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + 6);
      }

      // Last week edge case: end on semester end date if it would extend beyond
      if (currentEnd > semesterEnd) {
        currentEnd = new Date(semesterEnd);
      }

      weekData.push({
        semesterId,
        schoolId,
        weekNumber,
        startDate: this.formatDate(currentStart),
        endDate: this.formatDate(currentEnd),
        weekType: WeekType.REGULAR,
        isHoliday: false,
      });

      weekNumber++;
      // Next week starts the day after current week ends
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    // Atomic creation using transaction
    const createdWeeks = await this.dataSource.transaction(async (manager) => {
      const weekRepo = manager.getRepository(WeekEntity);
      const entities = weekRepo.create(weekData);
      return weekRepo.save(entities);
    });

    return {
      count: createdWeeks.length,
      weeks: createdWeeks.map((w) => ({
        id: w.id,
        weekNumber: w.weekNumber,
        startDate: w.startDate,
        endDate: w.endDate,
        weekType: w.weekType,
      })),
    };
  }

  async reorder(
    semesterId: string,
    dto: ReorderWeeksDto,
    _schoolId: string,
  ): Promise<WeekEntity[]> {
    const semester = await this.semesterRepository.findById(semesterId);
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }

    // Build updates: weekIds[0] → weekNumber=1, weekIds[1] → weekNumber=2, etc.
    const updates = dto.weekIds.map((id, index) => ({
      id,
      weekNumber: index + 1,
    }));

    // Update week_number values atomically in transaction
    await this.dataSource.transaction(async (manager) => {
      for (const { id, weekNumber } of updates) {
        await manager.update(WeekEntity, id, { weekNumber });
      }
    });

    return this.weekRepository.findBySemester(semesterId);
  }

  async remove(id: string, schoolId?: string): Promise<void> {
    await this.findById(id, schoolId);
    await this.weekRepository.softDelete(id);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
