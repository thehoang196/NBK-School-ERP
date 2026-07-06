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
export class RoomDoubleBookedChecker implements ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[] {
    if (target.roomId === null) {
      return [];
    }

    const key = `${target.roomId}-${target.dayOfWeek}-${target.periodId}`;
    const existingSlot = indexes.roomTimeslot.get(key);

    if (!existingSlot) {
      return [];
    }

    if (target.excludeSlotId && existingSlot.id === target.excludeSlotId) {
      return [];
    }

    return [
      {
        type: ConflictType.ROOM_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Phòng học đã được sử dụng tại tiết này',
        details: {
          conflictingSlotId: existingSlot.id,
          className: existingSlot.class?.name ?? '',
          teacherName: existingSlot.teacher?.fullName ?? '',
        },
      },
    ];
  }
}
