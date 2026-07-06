import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { ParsedSlotDto } from '../interfaces/fet-dto.interface';
import {
  IResultMapper,
  ResultMapperOutcome,
} from '../interfaces/generation-pipeline.interface';
import { ResultMappingException } from '../exceptions';

/**
 * Persists parsed FET output slots within a single database transaction.
 * Ensures atomicity — either all slots are saved or none.
 *
 * @implements IResultMapper
 */
@Injectable()
export class ResultMapperService implements IResultMapper {
  private readonly logger = new Logger(ResultMapperService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Persists all parsed slots within a single database transaction.
   *
   * @param versionId - The timetable version to associate slots with
   * @param slots - Parsed slot DTOs from FET output
   * @param schoolId - School identifier for multi-tenant isolation
   * @returns ResultMapperOutcome with slot count and any errors
   * @throws ResultMappingException on database errors
   */
  async persistSlots(
    versionId: string,
    slots: ParsedSlotDto[],
    schoolId: string,
  ): Promise<ResultMapperOutcome> {
    if (slots.length === 0) {
      this.logger.warn(`Không có slot nào để lưu cho version ${versionId}`);
      return { success: true, slotCount: 0, errors: [] };
    }

    try {
      const slotCount = await this.dataSource.transaction(async (manager) => {
        const slotEntities = slots.map((dto) => {
          const entity = new TimetableSlotEntity();
          entity.versionId = versionId;
          entity.schoolId = schoolId;
          entity.teacherId = dto.teacherId;
          entity.classId = dto.classId;
          entity.subjectId = dto.subjectId;
          entity.roomId = dto.roomId;
          entity.dayOfWeek = dto.dayOfWeek;
          entity.periodId = dto.periodId;
          entity.isDoublePeriod = dto.isDoublePeriod;
          return entity;
        });

        const saved = await manager.save(TimetableSlotEntity, slotEntities);
        return saved.length;
      });

      this.logger.log(
        `Đã lưu ${slotCount} slot cho version ${versionId} (school: ${schoolId})`,
      );

      return { success: true, slotCount, errors: [] };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Lỗi khi lưu slot cho version ${versionId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ResultMappingException(errorMessage, error);
    }
  }
}
