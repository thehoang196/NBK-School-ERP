import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { ActualTimetableSlotEntity } from '../entities/actual-timetable-slot.entity';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableStatus, SlotStatus } from '../../../common/enums/status.enum';
import { ConflictDetectionService } from './conflict-detection.service';
import { TimetablePublishedEvent } from '../events/timetable-published.event';
import { WeekEntity } from '../../academic/entities/week.entity';

export interface PublishResult {
  version: TimetableVersionEntity;
  slotsPublished: number;
  weeksAffected: number;
}

@Injectable()
export class TimetablePublishService {
  private readonly logger = new Logger(TimetablePublishService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly versionRepo: TimetableVersionRepository,
    private readonly slotRepo: TimetableSlotRepository,
    private readonly conflictDetection: ConflictDetectionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async publish(versionId: string, userId: string, startWeekId?: string): Promise<PublishResult> {
    const version = await this.versionRepo.findById(versionId);
    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }

    if (version.status === TimetableStatus.PUBLISHED) {
      throw new BadRequestException('Phiên bản đã được công bố');
    }

    // Check conflicts before publishing
    const conflicts = await this.conflictDetection.checkAllConflicts(versionId);
    const errorConflicts = conflicts.filter(c => c.severity === 'error');
    if (errorConflicts.length > 0) {
      throw new BadRequestException({
        message: `Không thể công bố: còn ${errorConflicts.length} xung đột chưa giải quyết`,
        conflicts: errorConflicts,
      });
    }

    // Get all slots of the version
    const slots = await this.slotRepo.findByVersion(versionId);
    if (slots.length === 0) {
      throw new BadRequestException('Phiên bản TKB chưa có slot nào');
    }

    // Get weeks to apply
    const weeks = await this.getWeeksToApply(version.semesterId, startWeekId);

    const result = await this.dataSource.transaction(async (manager) => {
      // Archive previously published version of same semester
      await manager.update(
        TimetableVersionEntity,
        { semesterId: version.semesterId, status: TimetableStatus.PUBLISHED },
        { status: TimetableStatus.ARCHIVED },
      );

      // Mark this version as published
      await manager.update(TimetableVersionEntity, versionId, {
        status: TimetableStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: userId,
      });

      // Clear existing actual slots for affected weeks
      for (const week of weeks) {
        await manager.softDelete(ActualTimetableSlotEntity, {
          semesterId: version.semesterId,
          weekId: week.id,
        });
      }

      // Create actual timetable slots for each week
      let totalSlotsPublished = 0;
      for (const week of weeks) {
        if (week.isHoliday) continue;

        const actualSlots = slots.map(slot => manager.create(ActualTimetableSlotEntity, {
          semesterId: version.semesterId,
          weekId: week.id,
          dayOfWeek: slot.dayOfWeek,
          periodId: slot.periodId,
          classId: slot.classId,
          teacherId: slot.teacherId,
          subjectId: slot.subjectId,
          roomId: slot.roomId,
          slotStatus: SlotStatus.SCHEDULED,
        }));

        await manager.save(ActualTimetableSlotEntity, actualSlots);
        totalSlotsPublished += actualSlots.length;
      }

      const updatedVersion = await manager.findOne(TimetableVersionEntity, {
        where: { id: versionId },
      });

      return {
        version: updatedVersion!,
        slotsPublished: totalSlotsPublished,
        weeksAffected: weeks.filter(w => !w.isHoliday).length,
      };
    });

    // Emit event after successful transaction commit to notify affected teachers
    this.emitPublishedEvent(versionId, version.semesterId, slots, userId);

    return result;
  }

  /**
   * Extract unique teacherIds from slots and emit TimetablePublishedEvent.
   * This is fire-and-forget; notification failures should not affect publish result.
   */
  private emitPublishedEvent(
    versionId: string,
    semesterId: string,
    slots: { teacherId: string }[],
    publishedBy: string,
  ): void {
    try {
      const uniqueTeacherIds = [...new Set(slots.map(slot => slot.teacherId))];

      const event = new TimetablePublishedEvent(
        versionId,
        semesterId,
        uniqueTeacherIds,
        publishedBy,
        new Date(),
      );

      this.eventEmitter.emit(TimetablePublishedEvent.eventName, event);

      this.logger.log(
        `Emitted ${TimetablePublishedEvent.eventName} event for version ${versionId}, ` +
        `notifying ${uniqueTeacherIds.length} teachers`,
      );
    } catch (error) {
      // Notification failure should not break the publish flow
      this.logger.error(
        `Failed to emit timetable.published event for version ${versionId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async getWeeksToApply(semesterId: string, startWeekId?: string): Promise<WeekEntity[]> {
    const weekRepo = this.dataSource.getRepository(WeekEntity);

    const qb = weekRepo.createQueryBuilder('week')
      .where('week.semester_id = :semesterId', { semesterId })
      .andWhere('week.deletedAt IS NULL')
      .orderBy('week.week_number', 'ASC');

    if (startWeekId) {
      const startWeek = await weekRepo.findOne({ where: { id: startWeekId } });
      if (startWeek) {
        qb.andWhere('week.week_number >= :weekNumber', { weekNumber: startWeek.weekNumber });
      }
    }

    return qb.getMany();
  }
}
