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
export class ClassDoubleBookedChecker implements ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[] {
    const key = `${target.classId}-${target.dayOfWeek}-${target.periodId}`;
    const existingSlot = indexes.classTimeslot.get(key);

    if (!existingSlot) {
      return [];
    }

    if (target.excludeSlotId && existingSlot.id === target.excludeSlotId) {
      return [];
    }

    return [
      {
        type: ConflictType.CLASS_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Lớp học đã có môn học khác tại tiết này',
        details: {
          conflictingSlotId: existingSlot.id,
          subjectName: existingSlot.subject?.name ?? '',
          teacherName: existingSlot.teacher?.fullName ?? '',
        },
      },
    ];
  }
}
