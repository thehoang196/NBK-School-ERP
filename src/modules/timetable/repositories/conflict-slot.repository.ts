import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { RoomEntity } from '../../room/entities/room.entity';

@Injectable()
export class ConflictSlotRepository {
  constructor(
    @InjectRepository(TimetableSlotEntity)
    private readonly slotRepo: Repository<TimetableSlotEntity>,
    @InjectRepository(PeriodDefinitionEntity)
    private readonly periodRepo: Repository<PeriodDefinitionEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,
  ) {}

  /**
   * Load existing slots for a single-slot check context.
   * Loads ALL slots in the version at the same dayOfWeek and periodId.
   * Relations loaded: class, teacher, subject, room (needed for conflict details).
   */
  async loadExistingSlots(
    versionId: string,
    dayOfWeek: number,
    periodId: string,
    schoolId: string,
  ): Promise<TimetableSlotEntity[]> {
    return this.slotRepo.find({
      where: {
        versionId,
        dayOfWeek,
        periodId,
        schoolId,
        deletedAt: IsNull(),
      },
      relations: ['class', 'teacher', 'subject', 'room'],
    });
  }

  /**
   * Load ALL slots for a version — used for full-version check.
   * Relations loaded: class, teacher, subject, room.
   * Filtered by schoolId for multi-tenant isolation.
   */
  async loadAllSlotsByVersion(
    versionId: string,
    schoolId: string,
  ): Promise<TimetableSlotEntity[]> {
    return this.slotRepo.find({
      where: {
        versionId,
        schoolId,
        deletedAt: IsNull(),
      },
      relations: ['class', 'teacher', 'subject', 'room'],
    });
  }

  /**
   * Load period definitions to build periodId → period_order mapping.
   * Returns a Map<string, number> (periodId → periodNumber).
   */
  async loadPeriodOrderMap(schoolId: string): Promise<Map<string, number>> {
    const periods = await this.periodRepo.find({
      where: {
        schoolId,
        deletedAt: IsNull(),
      },
      select: ['id', 'periodNumber'],
    });

    const map = new Map<string, number>();
    for (const period of periods) {
      map.set(period.id, period.periodNumber);
    }
    return map;
  }

  /**
   * Load rooms with campus_id to build roomId → campusId mapping.
   * Returns a Map<string, string> (roomId → campusId).
   * Only includes rooms that have a non-null campus_id.
   */
  async loadRoomCampusMap(schoolId: string): Promise<Map<string, string>> {
    const rooms = await this.roomRepo.find({
      where: {
        schoolId,
        campusId: Not(IsNull()),
        deletedAt: IsNull(),
      },
      select: ['id', 'campusId'],
    });

    const map = new Map<string, string>();
    for (const room of rooms) {
      if (room.campusId) {
        map.set(room.id, room.campusId);
      }
    }
    return map;
  }
}
