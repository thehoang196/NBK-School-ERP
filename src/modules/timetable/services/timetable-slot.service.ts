import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { ConflictDetectionService, ConflictResult } from './conflict-detection.service';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { CreateTimetableSlotDto } from '../dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from '../dto/update-timetable-slot.dto';
import { CheckConflictsDto } from '../dto/check-conflicts.dto';

@Injectable()
export class TimetableSlotService {
  constructor(
    private readonly slotRepository: TimetableSlotRepository,
    private readonly conflictDetectionService: ConflictDetectionService,
  ) {}

  /**
   * Tạo slot mới với kiểm tra xung đột
   * REQ-2.1: Lưu slot với version, day, period, class, teacher, subject, room
   * REQ-2.2: Hiển thị cảnh báo xung đột khi có conflicts
   */
  async create(dto: CreateTimetableSlotDto): Promise<TimetableSlotEntity> {
    const conflicts = await this.conflictDetectionService.checkSlotConflicts(
      dto.versionId,
      dto.dayOfWeek,
      dto.periodId,
      dto.teacherId,
      dto.classId,
      dto.roomId ?? null,
    );

    const errorConflicts = conflicts.filter(c => c.severity === 'error');
    if (errorConflicts.length > 0) {
      throw new BadRequestException({
        message: 'Phát hiện xung đột khi tạo slot',
        conflicts: errorConflicts,
      });
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
   * Cập nhật slot với kiểm tra xung đột
   * REQ-2.2: Hiển thị cảnh báo xung đột khi có conflicts
   */
  async update(id: string, dto: UpdateTimetableSlotDto): Promise<TimetableSlotEntity> {
    const existingSlot = await this.findById(id);

    // Merge existing values with update dto for conflict check
    const dayOfWeek = dto.dayOfWeek ?? existingSlot.dayOfWeek;
    const periodId = dto.periodId ?? existingSlot.periodId;
    const teacherId = dto.teacherId ?? existingSlot.teacherId;
    const classId = existingSlot.classId; // classId is not updatable in UpdateTimetableSlotDto
    const roomId = dto.roomId !== undefined ? dto.roomId : existingSlot.roomId;

    const conflicts = await this.conflictDetectionService.checkSlotConflicts(
      existingSlot.versionId,
      dayOfWeek,
      periodId,
      teacherId,
      classId,
      roomId ?? null,
      id, // exclude current slot
    );

    const errorConflicts = conflicts.filter(c => c.severity === 'error');
    if (errorConflicts.length > 0) {
      throw new BadRequestException({
        message: 'Phát hiện xung đột khi cập nhật slot',
        conflicts: errorConflicts,
      });
    }

    const updateData: Partial<TimetableSlotEntity> = {};
    if (dto.dayOfWeek !== undefined) updateData.dayOfWeek = dto.dayOfWeek;
    if (dto.periodId !== undefined) updateData.periodId = dto.periodId;
    if (dto.teacherId !== undefined) updateData.teacherId = dto.teacherId;
    if (dto.subjectId !== undefined) updateData.subjectId = dto.subjectId;
    if (dto.roomId !== undefined) updateData.roomId = dto.roomId;
    if (dto.isDoublePeriod !== undefined) updateData.isDoublePeriod = dto.isDoublePeriod;

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
   * Kiểm tra xung đột cho một vị trí cụ thể
   * REQ-4.1: Phát hiện các loại xung đột (teacher, class, room)
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
