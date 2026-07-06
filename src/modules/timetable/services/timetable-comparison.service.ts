import { Injectable, NotFoundException } from '@nestjs/common';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';

export enum DiffType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
}

export interface SlotDiff {
  type: DiffType;
  dayOfWeek: number;
  periodId: string;
  classId: string;
  slotA?: Partial<TimetableSlotEntity>;
  slotB?: Partial<TimetableSlotEntity>;
  changes?: string[];
}

export interface CompareResult {
  versionAId: string;
  versionAName: string;
  versionBId: string;
  versionBName: string;
  totalDiffs: number;
  added: number;
  removed: number;
  modified: number;
  diffs: SlotDiff[];
}

@Injectable()
export class TimetableComparisonService {
  constructor(
    private readonly slotRepo: TimetableSlotRepository,
    private readonly versionRepo: TimetableVersionRepository,
  ) {}

  async compareVersions(
    versionAId: string,
    versionBId: string,
  ): Promise<CompareResult> {
    const versionA = await this.versionRepo.findById(versionAId);
    const versionB = await this.versionRepo.findById(versionBId);

    if (!versionA || !versionB) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB');
    }

    const slotsA = await this.slotRepo.findByVersion(versionAId);
    const slotsB = await this.slotRepo.findByVersion(versionBId);

    // Tạo key unique cho mỗi slot: dayOfWeek-periodId-classId
    const mapA = new Map<string, TimetableSlotEntity>();
    const mapB = new Map<string, TimetableSlotEntity>();

    for (const slot of slotsA) {
      mapA.set(`${slot.dayOfWeek}-${slot.periodId}-${slot.classId}`, slot);
    }
    for (const slot of slotsB) {
      mapB.set(`${slot.dayOfWeek}-${slot.periodId}-${slot.classId}`, slot);
    }

    const diffs: SlotDiff[] = [];

    // Find removed (in A but not in B)
    for (const [key, slotA] of mapA) {
      if (!mapB.has(key)) {
        diffs.push({
          type: DiffType.REMOVED,
          dayOfWeek: slotA.dayOfWeek,
          periodId: slotA.periodId,
          classId: slotA.classId,
          slotA: this.extractSlotInfo(slotA),
        });
      }
    }

    // Find added (in B but not in A) and modified
    for (const [key, slotB] of mapB) {
      const slotA = mapA.get(key);
      if (!slotA) {
        diffs.push({
          type: DiffType.ADDED,
          dayOfWeek: slotB.dayOfWeek,
          periodId: slotB.periodId,
          classId: slotB.classId,
          slotB: this.extractSlotInfo(slotB),
        });
      } else {
        // Check for modifications
        const changes = this.findChanges(slotA, slotB);
        if (changes.length > 0) {
          diffs.push({
            type: DiffType.MODIFIED,
            dayOfWeek: slotB.dayOfWeek,
            periodId: slotB.periodId,
            classId: slotB.classId,
            slotA: this.extractSlotInfo(slotA),
            slotB: this.extractSlotInfo(slotB),
            changes,
          });
        }
      }
    }

    return {
      versionAId,
      versionAName: versionA.name,
      versionBId,
      versionBName: versionB.name,
      totalDiffs: diffs.length,
      added: diffs.filter((d) => d.type === DiffType.ADDED).length,
      removed: diffs.filter((d) => d.type === DiffType.REMOVED).length,
      modified: diffs.filter((d) => d.type === DiffType.MODIFIED).length,
      diffs,
    };
  }

  private findChanges(
    slotA: TimetableSlotEntity,
    slotB: TimetableSlotEntity,
  ): string[] {
    const changes: string[] = [];
    if (slotA.teacherId !== slotB.teacherId) changes.push('teacherId');
    if (slotA.subjectId !== slotB.subjectId) changes.push('subjectId');
    if (slotA.roomId !== slotB.roomId) changes.push('roomId');
    if (slotA.isDoublePeriod !== slotB.isDoublePeriod)
      changes.push('isDoublePeriod');
    return changes;
  }

  private extractSlotInfo(
    slot: TimetableSlotEntity,
  ): Partial<TimetableSlotEntity> {
    return {
      id: slot.id,
      teacherId: slot.teacherId,
      subjectId: slot.subjectId,
      roomId: slot.roomId,
      isDoublePeriod: slot.isDoublePeriod,
    };
  }
}
