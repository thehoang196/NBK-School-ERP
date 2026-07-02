import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { CreateTimetableVersionDto } from '../dto/create-timetable-version.dto';
import { UpdateTimetableVersionDto } from '../dto/update-timetable-version.dto';
import { SaveTimetableVersionDto } from '../dto/save-timetable-version.dto';
import { TimetableVersionQueryDto } from '../dto/timetable-query.dto';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { TimetableStatus } from '../../../common/enums/status.enum';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class TimetableVersionService {
  constructor(
    private readonly versionRepo: TimetableVersionRepository,
    private readonly slotRepo: TimetableSlotRepository,
    private readonly dataSource: DataSource,
  ) {}

  // === CRUD ===

  async create(dto: CreateTimetableVersionDto): Promise<TimetableVersionEntity> {
    const versionNumber = await this.versionRepo.getNextVersionNumber(dto.semesterId);

    return this.versionRepo.create({
      semesterId: dto.semesterId,
      name: dto.name,
      versionNumber,
      status: TimetableStatus.DRAFT,
      effectiveDate: dto.effectiveDate || null,
      note: dto.note || null,
    });
  }

  // === SAVE AS NEW VERSION ===

  async saveAsNewVersion(
    dto: SaveTimetableVersionDto,
    schoolId: string,
  ): Promise<TimetableVersionEntity> {
    // Validate name: không empty, không chỉ whitespace
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('Tên phiên bản không được để trống');
    }

    // Validate name length: ≤ 100 chars
    if (dto.name.length > 100) {
      throw new BadRequestException('Tên phiên bản tối đa 100 ký tự');
    }

    // Validate slots array: ≥ 1 slot
    if (!dto.slots || dto.slots.length === 0) {
      throw new BadRequestException('TKB trống không thể lưu phiên bản');
    }

    // Lấy next version number theo semesterId
    const versionNumber = await this.versionRepo.getNextVersionNumber(
      dto.semesterId,
    );

    // Transaction: create TimetableVersion (DRAFT) + bulk insert slots
    return this.dataSource.transaction(async (manager) => {
      const versionData = manager.create(TimetableVersionEntity, {
        semesterId: dto.semesterId,
        name: dto.name.trim(),
        versionNumber,
        status: TimetableStatus.DRAFT,
        effectiveDate: dto.effectiveDate || null,
        note: dto.note || null,
      });
      const newVersion = await manager.save(TimetableVersionEntity, versionData);

      // Bulk insert slots
      const slotEntities = dto.slots.map((slot) =>
        manager.create(TimetableSlotEntity, {
          versionId: newVersion.id,
          classId: slot.classId,
          dayOfWeek: slot.dayOfWeek,
          periodId: slot.periodId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId,
          roomId: slot.roomId || null,
          isDoublePeriod: slot.isDoublePeriod || false,
        }),
      );
      await manager.save(TimetableSlotEntity, slotEntities);

      return newVersion;
    });
  }

  async findAll(query: TimetableVersionQueryDto): Promise<PaginatedResponse<TimetableVersionEntity>> {
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

  async findById(id: string): Promise<TimetableVersionEntity> {
    const version = await this.versionRepo.findById(id);
    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }
    return version;
  }

  async update(id: string, dto: UpdateTimetableVersionDto): Promise<TimetableVersionEntity> {
    const version = await this.findById(id);

    if (version.status !== TimetableStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể cập nhật phiên bản ở trạng thái nháp');
    }

    const updated = await this.versionRepo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.effectiveDate !== undefined && { effectiveDate: dto.effectiveDate }),
      ...(dto.note !== undefined && { note: dto.note }),
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const version = await this.findById(id);

    if (version.status !== TimetableStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể xóa phiên bản ở trạng thái nháp');
    }

    await this.versionRepo.softDelete(id);
  }

  // === PUBLISH ===

  async publish(id: string, userId: string): Promise<TimetableVersionEntity> {
    const version = await this.findById(id);

    if (version.status !== TimetableStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể công bố phiên bản ở trạng thái nháp');
    }

    // Archive any currently published version for the same semester
    const currentPublished = await this.versionRepo.findPublished(version.semesterId);
    if (currentPublished) {
      await this.versionRepo.update(currentPublished.id, {
        status: TimetableStatus.ARCHIVED,
      });
    }

    // Publish the version
    const published = await this.versionRepo.publish(id, userId);
    if (!published) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }

    return published;
  }

  // === CLONE VERSION ===

  async cloneVersion(sourceVersionId: string): Promise<TimetableVersionEntity> {
    // 1. Find source version with slots
    const source = await this.versionRepo.findByIdWithSlots(sourceVersionId);
    if (!source) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }

    // 2. Only allow clone from PUBLISHED or ARCHIVED
    if (source.status !== TimetableStatus.PUBLISHED && source.status !== TimetableStatus.ARCHIVED) {
      throw new BadRequestException('Chỉ có thể tạo bản sao từ phiên bản đã công bố hoặc lưu trữ');
    }

    // 3. Get next version number
    const versionNumber = await this.versionRepo.getNextVersionNumber(source.semesterId);

    // 4. Auto-generate name
    const name = `Bản sao từ v${source.versionNumber} - ${source.name}`;

    // 5. Transaction: create new DRAFT version + copy all slots
    return this.dataSource.transaction(async (manager) => {
      const newVersion = manager.create(TimetableVersionEntity, {
        semesterId: source.semesterId,
        name,
        versionNumber,
        status: TimetableStatus.DRAFT,
        effectiveDate: source.effectiveDate,
        note: `Bản sao từ phiên bản v${source.versionNumber}`,
      });
      const savedVersion = await manager.save(TimetableVersionEntity, newVersion);

      // Copy all slots from source
      if (source.slots && source.slots.length > 0) {
        const newSlots = source.slots.map((slot) =>
          manager.create(TimetableSlotEntity, {
            versionId: savedVersion.id,
            classId: slot.classId,
            dayOfWeek: slot.dayOfWeek,
            periodId: slot.periodId,
            subjectId: slot.subjectId,
            teacherId: slot.teacherId,
            roomId: slot.roomId || null,
            isDoublePeriod: slot.isDoublePeriod || false,
          }),
        );
        await manager.save(TimetableSlotEntity, newSlots);
      }

      return savedVersion;
    });
  }

  // === ROLLBACK ===

  async rollback(id: string): Promise<TimetableVersionEntity> {
    const sourceVersion = await this.versionRepo.findByIdWithSlots(id);
    if (!sourceVersion) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB nguồn');
    }

    return this.dataSource.transaction(async (manager) => {
      // Create new draft version with content from old version
      const newVersionNumber = await this.versionRepo.getNextVersionNumber(sourceVersion.semesterId);

      const newVersionData = manager.create(TimetableVersionEntity, {
        semesterId: sourceVersion.semesterId,
        name: `Rollback từ v${sourceVersion.versionNumber} - ${sourceVersion.name}`,
        versionNumber: newVersionNumber,
        status: TimetableStatus.DRAFT,
        effectiveDate: sourceVersion.effectiveDate,
        note: `Rollback từ phiên bản #${sourceVersion.versionNumber}`,
      });
      const newVersion = await manager.save(TimetableVersionEntity, newVersionData);

      // Copy all slots from the source version
      if (sourceVersion.slots && sourceVersion.slots.length > 0) {
        const newSlots = sourceVersion.slots.map((slot) =>
          manager.create(TimetableSlotEntity, {
            versionId: newVersion.id,
            dayOfWeek: slot.dayOfWeek,
            periodId: slot.periodId,
            classId: slot.classId,
            teacherId: slot.teacherId,
            subjectId: slot.subjectId,
            roomId: slot.roomId,
            isDoublePeriod: slot.isDoublePeriod,
          }),
        );
        await manager.save(TimetableSlotEntity, newSlots);
      }

      return newVersion;
    });
  }

  // === OVERWRITE SLOTS ===

  async overwriteSlots(versionId: string, slots: CreateSlotDto[]): Promise<void> {
    // 1. Find version
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }

    // 2. Check status is DRAFT
    if (version.status !== TimetableStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa phiên bản ở trạng thái nháp');
    }

    // 3. Transaction: soft-delete existing slots → insert new slots
    await this.dataSource.transaction(async (manager) => {
      // Soft-delete all existing slots for this version
      await manager
        .createQueryBuilder()
        .update(TimetableSlotEntity)
        .set({ deletedAt: new Date() })
        .where('version_id = :versionId AND deleted_at IS NULL', { versionId })
        .execute();

      // Insert new slots
      if (slots.length > 0) {
        const newSlots = slots.map((slot) =>
          manager.create(TimetableSlotEntity, {
            versionId,
            classId: slot.classId,
            dayOfWeek: slot.dayOfWeek,
            periodId: slot.periodId,
            subjectId: slot.subjectId,
            teacherId: slot.teacherId,
            roomId: slot.roomId || null,
            isDoublePeriod: slot.isDoublePeriod || false,
          }),
        );
        await manager.save(TimetableSlotEntity, newSlots);
      }
    });
  }
}
