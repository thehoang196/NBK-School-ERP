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
export class SubjectConsecutiveDaysChecker implements ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[] {
    const key = `${target.classId}-${target.subjectId}`;
    const existingDays = indexes.subjectDays.get(key) ?? [];

    const hasAdjacentDay = existingDays.some(
      (day) => Math.abs(day - target.dayOfWeek) === 1,
    );

    if (hasAdjacentDay) {
      const affectedDays = [...existingDays, target.dayOfWeek].sort(
        (a, b) => a - b,
      );

      return [
        {
          type: ConflictType.SUBJECT_CONSECUTIVE_DAYS,
          severity: ConflictSeverity.WARNING,
          message: 'Môn học được xếp vào các ngày liên tiếp cho cùng lớp',
          details: {
            affectedDays,
            classId: target.classId,
            subjectId: target.subjectId,
            dayOfWeek: target.dayOfWeek,
          },
        },
      ];
    }

    return [];
  }
}
