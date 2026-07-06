import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { ConflictOrchestrationService } from './conflict-orchestration.service';
import {
  ConflictCheckResult,
  Conflict,
} from '../interfaces/conflict.interface';
import { ConflictSeverity } from '../enums/conflict.enum';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import {
  DropTeacherSubjectDto,
  MoveSlotDto,
  SwapSlotsDto,
  DropTeacherToSlotDto,
  PreviewDropDto,
  BatchDropDto,
} from '../dto/drag-drop.dto';

export interface DragDropResult {
  success: boolean;
  slot?: TimetableSlotEntity;
  slots?: TimetableSlotEntity[];
  warnings: Conflict[];
  message: string;
}

export interface BatchDropResult {
  success: boolean;
  created: TimetableSlotEntity[];
  skipped: Array<{ dayOfWeek: number; periodId: string; reason: string }>;
  warnings: Conflict[];
  message: string;
}

export interface AvailableTeacher {
  id: string;
  employeeCode: string;
  fullName: string;
  teacherType: string;
  currentPeriodsInDay: number;
  maxPeriodsPerDay: number;
  isAvailable: boolean;
  conflictReason: string | null;
}

@Injectable()
export class DragDropService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly slotRepo: TimetableSlotRepository,
    private readonly versionRepo: TimetableVersionRepository,
    private readonly conflictOrchestration: ConflictOrchestrationService,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  /**
   * Kéo GV + Môn vào ô trống
   */
  async dropTeacherSubject(
    dto: DropTeacherSubjectDto,
    schoolId: string,
    userId: string,
  ): Promise<DragDropResult> {
    await this.validateVersionDraft(dto.versionId);

    // Kiểm tra ô đã có slot chưa
    const existing = await this.slotRepo.findConflicts({
      versionId: dto.versionId,
      dayOfWeek: dto.dayOfWeek,
      periodId: dto.periodId,
    });
    const classConflict = existing.find((s) => s.classId === dto.classId);
    if (classConflict) {
      throw new BadRequestException(
        'Ô này đã có tiết học. Hãy xóa tiết cũ hoặc dùng chức năng hoán đổi.',
      );
    }

    // Check conflicts via orchestration service
    const conflictResult = await this.conflictOrchestration.checkSingleSlot(
      {
        versionId: dto.versionId,
        dayOfWeek: dto.dayOfWeek,
        periodId: dto.periodId,
        teacherId: dto.teacherId,
        classId: dto.classId,
        roomId: dto.roomId || undefined,
        subjectId: dto.subjectId,
      },
      schoolId,
      userId,
    );

    const errors = conflictResult.conflicts.filter(
      (c) => c.severity === ConflictSeverity.ERROR,
    );
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Không thể thả vào ô này do xung đột',
        conflicts: errors,
      });
    }

    // Tạo slot
    const slot = await this.slotRepo.create({
      versionId: dto.versionId,
      dayOfWeek: dto.dayOfWeek,
      periodId: dto.periodId,
      classId: dto.classId,
      teacherId: dto.teacherId,
      subjectId: dto.subjectId,
      roomId: dto.roomId || null,
      isDoublePeriod: dto.isDoublePeriod || false,
    });

    return {
      success: true,
      slot,
      warnings: conflictResult.conflicts.filter(
        (c) => c.severity === ConflictSeverity.WARNING,
      ),
      message: 'Đã thả GV + Môn vào TKB thành công',
    };
  }

  /**
   * Di chuyển slot sang vị trí khác
   */
  async moveSlot(
    dto: MoveSlotDto,
    schoolId: string,
    userId: string,
  ): Promise<DragDropResult> {
    const slot = await this.slotRepo.findById(dto.slotId);
    if (!slot) {
      throw new NotFoundException('Không tìm thấy slot');
    }

    await this.validateVersionDraft(slot.versionId);

    // Kiểm tra ô đích đã có slot cho cùng lớp chưa
    const existingAtTarget = await this.slotRepo.findConflicts({
      versionId: slot.versionId,
      dayOfWeek: dto.targetDayOfWeek,
      periodId: dto.targetPeriodId,
    });
    const classConflict = existingAtTarget.find(
      (s) => s.classId === slot.classId,
    );
    if (classConflict) {
      throw new BadRequestException(
        'Ô đích đã có tiết học cho lớp này. Hãy dùng chức năng hoán đổi.',
      );
    }

    // Check conflicts at new position via orchestration service
    const roomId =
      dto.targetRoomId !== undefined ? dto.targetRoomId : slot.roomId;
    const conflictResult = await this.conflictOrchestration.checkSingleSlot(
      {
        versionId: slot.versionId,
        dayOfWeek: dto.targetDayOfWeek,
        periodId: dto.targetPeriodId,
        teacherId: slot.teacherId,
        classId: slot.classId,
        roomId: roomId || undefined,
        subjectId: slot.subjectId,
        excludeSlotId: dto.slotId, // exclude self
      },
      schoolId,
      userId,
    );

    const errors = conflictResult.conflicts.filter(
      (c) => c.severity === ConflictSeverity.ERROR,
    );
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Không thể di chuyển đến vị trí này',
        conflicts: errors,
      });
    }

    // Update slot position
    const updated = await this.slotRepo.update(dto.slotId, {
      dayOfWeek: dto.targetDayOfWeek,
      periodId: dto.targetPeriodId,
      roomId: roomId || null,
    });

    return {
      success: true,
      slot: updated!,
      warnings: conflictResult.conflicts.filter(
        (c) => c.severity === ConflictSeverity.WARNING,
      ),
      message: 'Di chuyển slot thành công',
    };
  }

  /**
   * Hoán đổi 2 slots
   */
  async swapSlots(
    dto: SwapSlotsDto,
    schoolId: string,
    userId: string,
  ): Promise<DragDropResult> {
    const slotA = await this.slotRepo.findById(dto.slotAId);
    const slotB = await this.slotRepo.findById(dto.slotBId);

    if (!slotA || !slotB) {
      throw new NotFoundException('Không tìm thấy một hoặc cả hai slot');
    }

    if (slotA.versionId !== slotB.versionId) {
      throw new BadRequestException('Hai slot phải thuộc cùng phiên bản');
    }

    await this.validateVersionDraft(slotA.versionId);

    // Validate: check conflicts after swap via orchestration service
    const conflictsAResult = await this.conflictOrchestration.checkSingleSlot(
      {
        versionId: slotA.versionId,
        dayOfWeek: slotB.dayOfWeek,
        periodId: slotB.periodId,
        teacherId: slotA.teacherId,
        classId: slotA.classId,
        roomId: slotA.roomId || undefined,
        subjectId: slotA.subjectId,
        excludeSlotId: dto.slotAId,
      },
      schoolId,
      userId,
    );

    const conflictsBResult = await this.conflictOrchestration.checkSingleSlot(
      {
        versionId: slotB.versionId,
        dayOfWeek: slotA.dayOfWeek,
        periodId: slotA.periodId,
        teacherId: slotB.teacherId,
        classId: slotB.classId,
        roomId: slotB.roomId || undefined,
        subjectId: slotB.subjectId,
        excludeSlotId: dto.slotBId,
      },
      schoolId,
      userId,
    );

    const allConflicts = [
      ...conflictsAResult.conflicts,
      ...conflictsBResult.conflicts,
    ];
    const errors = allConflicts.filter(
      (c) => c.severity === ConflictSeverity.ERROR,
    );
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Không thể hoán đổi do xung đột',
        conflicts: errors,
      });
    }

    // Swap positions using transaction
    await this.dataSource.transaction(async (manager) => {
      await manager.update(TimetableSlotEntity, dto.slotAId, {
        dayOfWeek: slotB.dayOfWeek,
        periodId: slotB.periodId,
      });
      await manager.update(TimetableSlotEntity, dto.slotBId, {
        dayOfWeek: slotA.dayOfWeek,
        periodId: slotA.periodId,
      });
    });

    // Fetch updated slots
    const updatedA = await this.slotRepo.findById(dto.slotAId);
    const updatedB = await this.slotRepo.findById(dto.slotBId);

    return {
      success: true,
      slots: [updatedA!, updatedB!],
      warnings: allConflicts.filter(
        (c) => c.severity === ConflictSeverity.WARNING,
      ),
      message: 'Hoán đổi 2 slot thành công',
    };
  }

  /**
   * Kéo GV mới vào slot đã có (thay GV)
   */
  async dropTeacherToSlot(
    dto: DropTeacherToSlotDto,
    schoolId: string,
    userId: string,
  ): Promise<DragDropResult> {
    const slot = await this.slotRepo.findById(dto.slotId);
    if (!slot) {
      throw new NotFoundException('Không tìm thấy slot');
    }

    await this.validateVersionDraft(slot.versionId);

    if (slot.teacherId === dto.teacherId) {
      throw new BadRequestException('GV mới trùng với GV hiện tại');
    }

    // Check conflicts for new teacher via orchestration service
    const conflictResult = await this.conflictOrchestration.checkSingleSlot(
      {
        versionId: slot.versionId,
        dayOfWeek: slot.dayOfWeek,
        periodId: slot.periodId,
        teacherId: dto.teacherId,
        classId: slot.classId,
        roomId: slot.roomId || undefined,
        subjectId: slot.subjectId,
        excludeSlotId: dto.slotId,
      },
      schoolId,
      userId,
    );

    const errors = conflictResult.conflicts.filter(
      (c) => c.severity === ConflictSeverity.ERROR,
    );
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'GV mới bị xung đột tại thời điểm này',
        conflicts: errors,
      });
    }

    // Update teacher
    const updated = await this.slotRepo.update(dto.slotId, {
      teacherId: dto.teacherId,
    });

    return {
      success: true,
      slot: updated!,
      warnings: conflictResult.conflicts.filter(
        (c) => c.severity === ConflictSeverity.WARNING,
      ),
      message: 'Thay đổi GV thành công',
    };
  }

  /**
   * Preview - Xem trước xung đột không lưu
   */
  async previewDrop(
    dto: PreviewDropDto,
    schoolId: string,
    userId: string,
  ): Promise<{ canDrop: boolean; conflicts: Conflict[] }> {
    const conflictResult = await this.conflictOrchestration.checkSingleSlot(
      {
        versionId: dto.versionId,
        dayOfWeek: dto.dayOfWeek,
        periodId: dto.periodId,
        teacherId: dto.teacherId,
        classId: dto.classId,
        roomId: dto.roomId || undefined,
        subjectId: dto.subjectId,
      },
      schoolId,
      userId,
    );

    return {
      canDrop: !conflictResult.hasHardConflicts,
      conflicts: conflictResult.conflicts,
    };
  }

  /**
   * Kéo thả hàng loạt - GV+Môn vào nhiều ô
   */
  async batchDrop(
    dto: BatchDropDto,
    schoolId: string,
    userId: string,
  ): Promise<BatchDropResult> {
    await this.validateVersionDraft(dto.versionId);

    const created: TimetableSlotEntity[] = [];
    const skipped: Array<{
      dayOfWeek: number;
      periodId: string;
      reason: string;
    }> = [];
    const allWarnings: Conflict[] = [];

    for (const target of dto.targets) {
      // Check xung đột cho từng ô via orchestration service
      const conflictResult = await this.conflictOrchestration.checkSingleSlot(
        {
          versionId: dto.versionId,
          dayOfWeek: target.dayOfWeek,
          periodId: target.periodId,
          teacherId: dto.teacherId,
          classId: dto.classId,
          roomId: target.roomId || undefined,
          subjectId: dto.subjectId,
        },
        schoolId,
        userId,
      );

      const errors = conflictResult.conflicts.filter(
        (c) => c.severity === ConflictSeverity.ERROR,
      );

      if (errors.length > 0) {
        if (dto.skipConflicts) {
          skipped.push({
            dayOfWeek: target.dayOfWeek,
            periodId: target.periodId,
            reason: errors.map((e) => e.message).join('; '),
          });
          continue;
        } else {
          throw new BadRequestException({
            message: `Xung đột tại Thứ ${target.dayOfWeek}, tiết ${target.periodId}`,
            conflicts: errors,
          });
        }
      }

      // Kiểm tra ô đã có chưa
      const existing = await this.slotRepo.findConflicts({
        versionId: dto.versionId,
        dayOfWeek: target.dayOfWeek,
        periodId: target.periodId,
      });
      if (existing.find((s) => s.classId === dto.classId)) {
        if (dto.skipConflicts) {
          skipped.push({
            dayOfWeek: target.dayOfWeek,
            periodId: target.periodId,
            reason: 'Ô đã có tiết học cho lớp này',
          });
          continue;
        } else {
          throw new BadRequestException(
            `Ô Thứ ${target.dayOfWeek} đã có tiết cho lớp này`,
          );
        }
      }

      // Tạo slot
      const slot = await this.slotRepo.create({
        versionId: dto.versionId,
        dayOfWeek: target.dayOfWeek,
        periodId: target.periodId,
        classId: dto.classId,
        teacherId: dto.teacherId,
        subjectId: dto.subjectId,
        roomId: target.roomId || null,
        isDoublePeriod: false,
      });

      created.push(slot);
      allWarnings.push(
        ...conflictResult.conflicts.filter(
          (c) => c.severity === ConflictSeverity.WARNING,
        ),
      );
    }

    return {
      success: true,
      created,
      skipped,
      warnings: allWarnings,
      message: `Đã tạo ${created.length}/${dto.targets.length} slot. Bỏ qua ${skipped.length} ô.`,
    };
  }

  /**
   * Lấy danh sách GV khả dụng cho 1 ô cụ thể
   */
  async getAvailableTeachers(
    versionId: string,
    dayOfWeek: number,
    periodId: string,
    subjectId?: string,
  ): Promise<AvailableTeacher[]> {
    // Lấy tất cả GV active
    const teachers = await this.teacherRepo.find({
      where: { status: 'active' as never, deletedAt: IsNull() },
    });

    // Lấy slots tại thời điểm đó
    const existingSlots = await this.slotRepo.findConflicts({
      versionId,
      dayOfWeek,
      periodId,
    });

    // Lấy tất cả slots trong ngày cho mỗi GV (để check max periods/day)
    const allSlotsInVersion = await this.slotRepo.findByQuery({ versionId });

    const result: AvailableTeacher[] = [];

    for (const teacher of teachers) {
      let isAvailable = true;
      let conflictReason: string | null = null;

      // Check: GV đã có tiết tại thời điểm này
      const teacherBusy = existingSlots.find((s) => s.teacherId === teacher.id);
      if (teacherBusy) {
        isAvailable = false;
        conflictReason = 'GV đã có tiết dạy vào thời điểm này';
      }

      // Check: GV unavailable
      if (isAvailable && teacher.unavailableSlots) {
        const unavailable = teacher.unavailableSlots.some(
          (s) => s.dayOfWeek === dayOfWeek && s.periodId === periodId,
        );
        if (unavailable) {
          isAvailable = false;
          conflictReason = 'GV đã đăng ký không khả dụng';
        }
      }

      // Count periods in day
      const periodsInDay = allSlotsInVersion.filter(
        (s) => s.teacherId === teacher.id && s.dayOfWeek === dayOfWeek,
      ).length;

      // Check max periods per day
      if (isAvailable && periodsInDay >= teacher.maxPeriodsPerDay) {
        isAvailable = false;
        conflictReason = `Đã đạt số tiết tối đa/ngày (${teacher.maxPeriodsPerDay})`;
      }

      result.push({
        id: teacher.id,
        employeeCode: teacher.employeeCode,
        fullName: teacher.fullName,
        teacherType: teacher.teacherType,
        currentPeriodsInDay: periodsInDay,
        maxPeriodsPerDay: teacher.maxPeriodsPerDay,
        isAvailable,
        conflictReason,
      });
    }

    // Sort: available first, then by name
    result.sort((a, b) => {
      if (a.isAvailable && !b.isAvailable) return -1;
      if (!a.isAvailable && b.isAvailable) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

    return result;
  }

  private async validateVersionDraft(versionId: string): Promise<void> {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }
    if (version.status !== TimetableVersionStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa phiên bản nháp');
    }
  }
}
