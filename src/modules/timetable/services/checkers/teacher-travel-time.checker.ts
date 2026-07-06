import { Injectable } from '@nestjs/common';
import {
  ConflictChecker,
  ConflictIndexes,
} from '../../interfaces/conflict-index.interface';
import {
  Conflict,
  SlotCheckPayload,
} from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';

@Injectable()
export class TeacherTravelTimeChecker implements ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[] {
    const targetOrder = indexes.periodOrderMap.get(target.periodId);
    if (targetOrder === undefined) {
      return [];
    }

    if (target.roomId === null) {
      return [];
    }

    const targetCampus = indexes.roomCampusMap.get(target.roomId);
    if (targetCampus === undefined) {
      return [];
    }

    const key = `${target.teacherId}-${target.dayOfWeek}`;
    const teacherSlots = indexes.teacherDaySlots.get(key) ?? [];

    const conflicts: Conflict[] = [];

    for (const slot of teacherSlots) {
      // Exclude self
      if (target.excludeSlotId && slot.id === target.excludeSlotId) {
        continue;
      }

      const slotOrder = indexes.periodOrderMap.get(slot.periodId);
      if (slotOrder === undefined) {
        continue;
      }

      // Check if adjacent (±1)
      if (Math.abs(slotOrder - targetOrder) !== 1) {
        continue;
      }

      if (slot.roomId === null) {
        continue;
      }

      const slotCampus = indexes.roomCampusMap.get(slot.roomId);
      if (slotCampus === undefined) {
        continue;
      }

      if (slotCampus !== targetCampus) {
        conflicts.push({
          type: ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME,
          severity: ConflictSeverity.WARNING,
          message: 'Giáo viên không đủ thời gian di chuyển giữa hai cơ sở',
          details: {
            campusFrom: slotCampus,
            campusTo: targetCampus,
            teacherId: target.teacherId,
            dayOfWeek: target.dayOfWeek,
            periodId: target.periodId,
          },
        });
      }
    }

    return conflicts;
  }
}
