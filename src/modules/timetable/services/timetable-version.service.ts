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
import { TimetableVersionQueryDto } from '../dto/timetable-query.dto';
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
}
