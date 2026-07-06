import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PeriodDefinitionRepository } from '../repositories/period-definition.repository';
import { PeriodDefinitionEntity } from '../entities/period-definition.entity';
import {
  CreatePeriodDefinitionDto,
  UpdatePeriodDefinitionDto,
  PeriodDefinitionQueryDto,
} from '../dto/period-definition';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import {
  PeriodOverlapException,
  InvalidDateRangeException,
} from '../exceptions';
import { GradeLevel } from '../enums';

@Injectable()
export class PeriodDefinitionService {
  constructor(
    private readonly periodDefinitionRepository: PeriodDefinitionRepository,
  ) {}

  async findAll(
    query: PeriodDefinitionQueryDto,
    schoolId: string,
  ): Promise<PaginatedResponse<PeriodDefinitionEntity>> {
    const [data, total] = await this.periodDefinitionRepository.findAll(
      query,
      schoolId,
    );
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách tiết học thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(
    id: string,
    schoolId?: string,
  ): Promise<PeriodDefinitionEntity> {
    const period = await this.periodDefinitionRepository.findById(id, schoolId);
    if (!period) {
      throw new NotFoundException('Không tìm thấy tiết học');
    }
    return period;
  }

  async findBySession(sessionId: string): Promise<PeriodDefinitionEntity[]> {
    return this.periodDefinitionRepository.findBySession(sessionId);
  }

  async findBySchool(schoolId: string): Promise<PeriodDefinitionEntity[]> {
    return this.periodDefinitionRepository.findBySchool(schoolId);
  }

  async create(
    dto: CreatePeriodDefinitionDto,
    schoolId: string,
  ): Promise<PeriodDefinitionEntity> {
    this.validatePeriodNumber(dto.periodNumber);
    this.validateTimeRange(dto.startTime, dto.endTime);

    const isBreak = dto.isBreak ?? false;

    // Only check overlap for non-break periods (Req 6.4)
    if (!isBreak && dto.gradeLevel) {
      await this.checkOverlap(
        dto.sessionId,
        dto.gradeLevel,
        dto.startTime,
        dto.endTime,
      );
    }

    return this.periodDefinitionRepository.create({
      schoolId,
      sessionId: dto.sessionId,
      gradeLevel: dto.gradeLevel,
      periodNumber: dto.periodNumber,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isBreak,
      isExtra: dto.isExtra ?? false,
    });
  }

  async update(
    id: string,
    dto: UpdatePeriodDefinitionDto,
    schoolId?: string,
  ): Promise<PeriodDefinitionEntity> {
    const period = await this.findById(id, schoolId);

    // Validate periodNumber if provided (Req 5.1)
    if (dto.periodNumber !== undefined) {
      this.validatePeriodNumber(dto.periodNumber);
    }

    // Determine effective start/end times after update
    const effectiveStartTime = dto.startTime ?? period.startTime;
    const effectiveEndTime = dto.endTime ?? period.endTime;

    // Validate time range (Req 6.3)
    this.validateTimeRange(effectiveStartTime, effectiveEndTime);

    // Determine effective isBreak and gradeLevel
    const effectiveIsBreak = dto.isBreak ?? period.isBreak;
    const effectiveGradeLevel = dto.gradeLevel ?? period.gradeLevel;

    // Check overlap for non-break periods when time or gradeLevel changes (Req 6.4)
    if (!effectiveIsBreak && (dto.startTime || dto.endTime || dto.gradeLevel)) {
      await this.checkOverlap(
        period.sessionId,
        effectiveGradeLevel as GradeLevel,
        effectiveStartTime,
        effectiveEndTime,
        id, // exclude self from overlap check
      );
    }

    const updated = await this.periodDefinitionRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tiết học');
    }
    return updated;
  }

  async remove(id: string, schoolId?: string): Promise<void> {
    await this.findById(id, schoolId);
    await this.periodDefinitionRepository.softDelete(id);
  }

  /**
   * Validate that periodNumber is a positive integer (> 0).
   * Throws BadRequestException if invalid. (Req 5.1)
   */
  private validatePeriodNumber(periodNumber: number): void {
    if (!Number.isInteger(periodNumber) || periodNumber <= 0) {
      throw new BadRequestException(
        'Số thứ tự tiết phải là số nguyên dương lớn hơn 0',
      );
    }
  }

  /**
   * Validate that start_time is strictly before end_time.
   * Throws InvalidDateRangeException if invalid. (Req 6.3)
   */
  private validateTimeRange(startTime: string, endTime: string): void {
    if (startTime >= endTime) {
      throw new InvalidDateRangeException(
        'Giờ bắt đầu phải trước giờ kết thúc',
      );
    }
  }

  /**
   * Check if the new period's time range overlaps with existing non-break periods
   * in the same session and grade level. (Req 6.4)
   * Break periods (is_break = true) may overlap adjacent period boundaries.
   * Overlap condition: NOT (existing.endTime <= newStartTime OR existing.startTime >= newEndTime)
   *
   * @param excludeId - Optional period ID to exclude from overlap check (used during update)
   */
  private async checkOverlap(
    sessionId: string,
    gradeLevel: GradeLevel,
    newStartTime: string,
    newEndTime: string,
    excludeId?: string,
  ): Promise<void> {
    const existingPeriods =
      await this.periodDefinitionRepository.findBySessionAndGradeLevel(
        sessionId,
        gradeLevel,
      );

    for (const existing of existingPeriods) {
      // Skip the period being updated (self-exclusion)
      if (excludeId && existing.id === excludeId) {
        continue;
      }

      // Skip break periods — they are excluded from overlap checking
      if (existing.isBreak) {
        continue;
      }

      // Check overlap: NOT (existing.endTime <= newStartTime OR existing.startTime >= newEndTime)
      const noOverlap =
        existing.endTime <= newStartTime || existing.startTime >= newEndTime;
      if (!noOverlap) {
        throw new PeriodOverlapException();
      }
    }
  }
}
