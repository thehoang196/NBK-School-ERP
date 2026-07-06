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

const DEFAULT_MAX_PERIODS_PER_DAY = 8;

@Injectable()
export class TeacherMaxPerDayChecker implements ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[] {
    const key = `${target.teacherId}-${target.dayOfWeek}`;
    const existingPeriods = indexes.teacherDayPeriods.get(key) ?? [];

    // Total including the target slot being added
    const total = existingPeriods.length + 1;

    const maxPeriodsPerDay = DEFAULT_MAX_PERIODS_PER_DAY;

    if (total > maxPeriodsPerDay) {
      return [
        {
          type: ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED,
          severity: ConflictSeverity.WARNING,
          message: 'Giáo viên vượt quá số tiết tối đa trong ngày',
          details: {
            currentCount: total,
            maxAllowed: maxPeriodsPerDay,
            teacherId: target.teacherId,
            dayOfWeek: target.dayOfWeek,
          },
        },
      ];
    }

    return [];
  }
}
