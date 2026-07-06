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
export class TeacherDoubleBookedChecker implements ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[] {
    const key = `${target.teacherId}-${target.dayOfWeek}-${target.periodId}`;
    const existingSlot = indexes.teacherTimeslot.get(key);

    if (!existingSlot) {
      return [];
    }

    if (target.excludeSlotId && existingSlot.id === target.excludeSlotId) {
      return [];
    }

    return [
      {
        type: ConflictType.TEACHER_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Giáo viên đã có lịch dạy tại tiết này',
        details: {
          conflictingSlotId: existingSlot.id,
          className: existingSlot.class?.name ?? '',
          subjectName: existingSlot.subject?.name ?? '',
        },
      },
    ];
  }
}
