import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { ConflictOrchestrationService } from './conflict-orchestration.service';
import { ConflictDetectionService } from './conflict-detection.service';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { CreateTimetableSlotDto } from '../dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from '../dto/update-timetable-slot.dto';
import { CheckConflictsDto } from '../dto/check-conflicts.dto';
import {
  OverridePayload,
  ConflictCheckResult,
} from '../interfaces/conflict.interface';
import {
  HardConflictDetectedException,
  SoftConflictRequiresOverrideException,
} from '../exceptions/conflict.exception';
import { ConflictResult } from './conflict-detection.service';

@Injectable()
export class TimetableSlotService {
  private readonly logger = new Logger(TimetableSlotService.name);

  constructor(
    private readonly slotRepository: TimetableSlotRepository,
    private readonly conflictOrchestrationService: ConflictOrchestrationService,
    private readonly conflictDetectionService: ConflictDetectionService,
  ) {}

  /**
   * Tạo slot mới với kiểm tra xung đột qua ConflictOrchestrationService.
   *
   * Flow:
   * - hasHardConflicts → throw 422 HardConflictDetectedException
   * - hasSoftConflicts without override → throw 422 SoftConflictRequiresOverrideException
   * - hasSoftConflicts with valid override → proceed and log
   * - no conflicts → proceed
   *
   * Requirements: 1.1, 1.2, 2.1, 8.1, 8.4, 12.2
   */
  async create(
    dto: CreateTimetableSlotDto,
    schoolId: string,
    userId: string,
    overridePayload?: OverridePayload,
  ): Promise<TimetableSlotEntity> {
    // Run conflict detection through orchestration service
    const conflictResult =
      await this.conflictOrchestrationService.checkSingleSlot(
        {
          versionId: dto.versionId,
          dayOfWeek: dto.dayOfWeek,
          periodId: dto.periodId,
          teacherId: dto.teacherId,
          classId: dto.classId,
          roomId: dto.roomId ?? undefined,
          subjectId: dto.subjectId,
        },
        schoolId,
        userId,
      );

    // Hard conflicts always block save (Req 8.4)
    if (conflictResult.hasHardConflicts) {
      throw new HardConflictDetectedException(conflictResult.conflicts);
    }

    // Soft conflicts without override → block save (Req 8.2)
    if (conflictResult.hasSoftConflicts && !overridePayload) {
      throw new SoftConflictRequiresOverrideException(conflictResult.conflicts);
    }

    // Soft conflicts with valid override → proceed (Req 8.1)
    if (conflictResult.hasSoftConflicts && overridePayload) {
      this.logger.log(
        `Soft conflicts overridden for create slot: version=${dto.versionId}, ` +
          `teacher=${dto.teacherId}, class=${dto.classId}, reason="${overridePayload.reason}", user=${userId}`,
      );
    }

    return this.slotRepository.create({
      versionId: dto.versionId,
      dayOfWeek: dto.dayOfWeek,
      periodId: dto.periodId,
      classId: dto.classId,
      teacherId: dto.teacherId,
      subjectId: dto.subjectId,
      roomId: dto.roomId ?? null,
      isDoublePeriod: dto.isDoublePeriod ?? false,
    });
  }

  /**
   * Lấy tất cả slots theo phiên bản
   */
  async findByVersion(versionId: string): Promise<TimetableSlotEntity[]> {
    return this.slotRepository.findByVersion(versionId);
  }

  /**
   * Lấy slot theo ID
   */
  async findById(id: string): Promise<TimetableSlotEntity> {
    const slot = await this.slotRepository.findById(id);
    if (!slot) {
      throw new NotFoundException('Không tìm thấy slot TKB');
    }
    return slot;
  }

  /**
   * Cập nhật slot với kiểm tra xung đột qua ConflictOrchestrationService.
   *
   * Flow:
   * - hasHardConflicts → throw 422 HardConflictDetectedException
   * - hasSoftConflicts without override → throw 422 SoftConflictRequiresOverrideException
   * - hasSoftConflicts with valid override → proceed and log
   * - no conflicts → proceed
   *
   * Requirements: 1.1, 1.2, 2.1, 8.1, 8.4, 12.2
   */
  async update(
    id: string,
    dto: UpdateTimetableSlotDto,
    schoolId: string,
    userId: string,
    overridePayload?: OverridePayload,
  ): Promise<TimetableSlotEntity> {
    const existingSlot = await this.findById(id);

    // Merge existing values with update dto for conflict check
    const dayOfWeek = dto.dayOfWeek ?? existingSlot.dayOfWeek;
    const periodId = dto.periodId ?? existingSlot.periodId;
    const teacherId = dto.teacherId ?? existingSlot.teacherId;
    const classId = existingSlot.classId; // classId is not updatable
    const roomId = dto.roomId !== undefined ? dto.roomId : existingSlot.roomId;
    const subjectId = dto.subjectId ?? existingSlot.subjectId;

    // Run conflict detection through orchestration service
    const conflictResult =
      await this.conflictOrchestrationService.checkSingleSlot(
        {
          versionId: existingSlot.versionId,
          dayOfWeek,
          periodId,
          teacherId,
          classId,
          roomId: roomId ?? undefined,
          subjectId,
          excludeSlotId: id, // Exclude self (Req 1.3)
        },
        schoolId,
        userId,
      );

    // Hard conflicts always block save (Req 8.4)
    if (conflictResult.hasHardConflicts) {
      throw new HardConflictDetectedException(conflictResult.conflicts);
    }

    // Soft conflicts without override → block save (Req 8.2)
    if (conflictResult.hasSoftConflicts && !overridePayload) {
      throw new SoftConflictRequiresOverrideException(conflictResult.conflicts);
    }

    // Soft conflicts with valid override → proceed (Req 8.1)
    if (conflictResult.hasSoftConflicts && overridePayload) {
      this.logger.log(
        `Soft conflicts overridden for update slot ${id}: ` +
          `reason="${overridePayload.reason}", user=${userId}`,
      );
    }

    const updateData: Partial<TimetableSlotEntity> = {};
    if (dto.dayOfWeek !== undefined) updateData.dayOfWeek = dto.dayOfWeek;
    if (dto.periodId !== undefined) updateData.periodId = dto.periodId;
    if (dto.teacherId !== undefined) updateData.teacherId = dto.teacherId;
    if (dto.subjectId !== undefined) updateData.subjectId = dto.subjectId;
    if (dto.roomId !== undefined) updateData.roomId = dto.roomId;
    if (dto.isDoublePeriod !== undefined)
      updateData.isDoublePeriod = dto.isDoublePeriod;

    const updated = await this.slotRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy slot TKB');
    }

    return updated;
  }

  /**
   * Xóa mềm slot
   */
  async delete(id: string): Promise<void> {
    await this.findById(id); // ensure slot exists
    await this.slotRepository.softDelete(id);
  }

  /**
   * Kiểm tra xung đột cho một vị trí cụ thể (legacy check-conflicts endpoint).
   * Kept for backward compatibility with check-conflicts endpoint.
   */
  async checkConflicts(dto: CheckConflictsDto): Promise<ConflictResult[]> {
    return this.conflictDetectionService.checkSlotConflicts(
      dto.versionId,
      dto.dayOfWeek,
      dto.periodId,
      dto.teacherId,
      dto.classId,
      dto.roomId ?? null,
      dto.excludeSlotId,
    );
  }
}
