import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { CreateTimetableVersionDto } from '../dto/create-timetable-version.dto';
import { CreateTimetableSlotDto } from '../dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from '../dto/update-timetable-slot.dto';
import { CheckConflictsDto } from '../dto/check-conflicts.dto';
import {
  TimetableVersionQueryDto,
  TimetableSlotQueryDto,
} from '../dto/timetable-query.dto';
import {
  ConflictDetectionService,
  ConflictResult,
} from './conflict-detection.service';
import { ConflictOrchestrationService } from './conflict-orchestration.service';
import { Conflict, OverridePayload } from '../interfaces/conflict.interface';
import { ConflictSeverity } from '../enums/conflict.enum';
import {
  HardConflictDetectedException,
  SoftConflictRequiresOverrideException,
} from '../exceptions/conflict.exception';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

export interface SlotWithConflicts {
  slot: TimetableSlotEntity;
  conflicts: Conflict[];
}

@Injectable()
export class TimetableService {
  constructor(
    private readonly versionRepo: TimetableVersionRepository,
    private readonly slotRepo: TimetableSlotRepository,
    private readonly conflictDetection: ConflictDetectionService,
    private readonly conflictOrchestration: ConflictOrchestrationService,
  ) {}

  // === VERSION MANAGEMENT ===

  async findAllVersions(
    query: TimetableVersionQueryDto,
  ): Promise<PaginatedResponse<TimetableVersionEntity>> {
    const [versions, total] = await this.versionRepo.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data: versions,
      message: 'Lấy danh sách phiên bản TKB thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findVersionById(id: string): Promise<TimetableVersionEntity> {
    const version = await this.versionRepo.findById(id);
    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }
    return version;
  }

  async createVersion(
    dto: CreateTimetableVersionDto,
  ): Promise<TimetableVersionEntity> {
    const versionNumber = await this.versionRepo.getNextVersionNumber(
      dto.semesterId,
    );

    return this.versionRepo.create({
      semesterId: dto.semesterId,
      name: dto.name,
      versionNumber,
      status: TimetableVersionStatus.DRAFT,
      effectiveDate: dto.effectiveDate || null,
      note: dto.note || null,
    });
  }

  async rollbackVersion(
    sourceVersionId: string,
  ): Promise<TimetableVersionEntity> {
    const sourceVersion =
      await this.versionRepo.findByIdWithSlots(sourceVersionId);
    if (!sourceVersion) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB nguồn');
    }

    // Tạo phiên bản mới với nội dung của phiên bản cũ
    const newVersionNumber = await this.versionRepo.getNextVersionNumber(
      sourceVersion.semesterId,
    );
    const newVersion = await this.versionRepo.create({
      semesterId: sourceVersion.semesterId,
      name: `Rollback từ v${sourceVersion.versionNumber} - ${sourceVersion.name}`,
      versionNumber: newVersionNumber,
      status: TimetableVersionStatus.DRAFT,
      effectiveDate: sourceVersion.effectiveDate,
      note: `Rollback từ phiên bản #${sourceVersion.versionNumber}`,
    });

    // Copy slots
    if (sourceVersion.slots && sourceVersion.slots.length > 0) {
      const newSlots = sourceVersion.slots.map((slot) => ({
        versionId: newVersion.id,
        dayOfWeek: slot.dayOfWeek,
        periodId: slot.periodId,
        classId: slot.classId,
        teacherId: slot.teacherId,
        subjectId: slot.subjectId,
        roomId: slot.roomId,
        isDoublePeriod: slot.isDoublePeriod,
      }));
      await this.slotRepo.createMany(newSlots);
    }

    return newVersion;
  }

  async deleteVersion(id: string): Promise<void> {
    const version = await this.findVersionById(id);
    if (version.status === TimetableVersionStatus.PUBLISHED) {
      throw new BadRequestException('Không thể xóa phiên bản đã công bố');
    }
    await this.slotRepo.deleteByVersion(id);
    await this.versionRepo.softDelete(id);
  }

  // === SLOT MANAGEMENT ===

  async findSlots(
    query: TimetableSlotQueryDto,
  ): Promise<TimetableSlotEntity[]> {
    return this.slotRepo.findByQuery(query);
  }

  async createSlot(
    dto: CreateTimetableSlotDto,
    schoolId: string,
    userId: string,
    overridePayload?: OverridePayload,
  ): Promise<SlotWithConflicts> {
    // Check version exists and is draft
    const version = await this.findVersionById(dto.versionId);
    if (version.status !== TimetableVersionStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa phiên bản nháp');
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

    // Hard conflicts always block save (Req 8.4)
    if (conflictResult.hasHardConflicts) {
      throw new HardConflictDetectedException(conflictResult.conflicts);
    }

    // Soft conflicts without override → block save (Req 8.2)
    if (conflictResult.hasSoftConflicts && !overridePayload) {
      throw new SoftConflictRequiresOverrideException(conflictResult.conflicts);
    }

    // Create slot (soft conflicts with valid override → proceed)
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
      slot,
      conflicts: conflictResult.conflicts.filter(
        (c) => c.severity === ConflictSeverity.WARNING,
      ),
    };
  }

  async updateSlot(
    id: string,
    dto: UpdateTimetableSlotDto,
    schoolId: string,
    userId: string,
    overridePayload?: OverridePayload,
  ): Promise<SlotWithConflicts> {
    const existingSlot = await this.slotRepo.findById(id);
    if (!existingSlot) {
      throw new NotFoundException('Không tìm thấy slot');
    }

    const version = await this.findVersionById(existingSlot.versionId);
    if (version.status !== TimetableVersionStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa phiên bản nháp');
    }

    // Check conflicts with new data via orchestration service
    const dayOfWeek = dto.dayOfWeek || existingSlot.dayOfWeek;
    const periodId = dto.periodId || existingSlot.periodId;
    const teacherId = dto.teacherId || existingSlot.teacherId;
    const roomId = dto.roomId !== undefined ? dto.roomId : existingSlot.roomId;
    const subjectId = dto.subjectId || existingSlot.subjectId;

    const conflictResult = await this.conflictOrchestration.checkSingleSlot(
      {
        versionId: existingSlot.versionId,
        dayOfWeek,
        periodId,
        teacherId,
        classId: existingSlot.classId,
        roomId: roomId || undefined,
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

    const updated = await this.slotRepo.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy slot');
    }

    return {
      slot: updated,
      conflicts: conflictResult.conflicts.filter(
        (c) => c.severity === ConflictSeverity.WARNING,
      ),
    };
  }

  async deleteSlot(id: string): Promise<void> {
    const slot = await this.slotRepo.findById(id);
    if (!slot) {
      throw new NotFoundException('Không tìm thấy slot');
    }

    const version = await this.findVersionById(slot.versionId);
    if (version.status !== TimetableVersionStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa phiên bản nháp');
    }

    await this.slotRepo.softDelete(id);
  }

  async checkConflicts(versionId: string): Promise<ConflictResult[]> {
    await this.findVersionById(versionId);
    return this.conflictDetection.checkAllConflicts(versionId);
  }

  async checkSlotConflicts(dto: CheckConflictsDto): Promise<ConflictResult[]> {
    return this.conflictDetection.checkSlotConflicts(
      dto.versionId,
      dto.dayOfWeek,
      dto.periodId,
      dto.teacherId,
      dto.classId,
      dto.roomId || null,
      dto.excludeSlotId,
    );
  }
}
