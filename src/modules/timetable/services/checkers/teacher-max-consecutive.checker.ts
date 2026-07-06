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

const DEFAULT_MAX_CONSECUTIVE = 4;

@Injectable()
export class TeacherMaxConsecutiveChecker implements ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[] {
    const key = `${target.teacherId}-${target.dayOfWeek}`;
    const existingPeriodOrders = indexes.teacherDayPeriods.get(key) ?? [];

    const targetOrder = indexes.periodOrderMap.get(target.periodId);
    if (targetOrder === undefined) {
      return [];
    }

    // Simulate adding the target's period order
    const allOrders = [...existingPeriodOrders, targetOrder];
    allOrders.sort((a, b) => a - b);

    // Find the longest consecutive sequence (consecutive = differ by 1)
    const longestConsecutive = this.findLongestConsecutive(allOrders);

    const maxConsecutive = DEFAULT_MAX_CONSECUTIVE;

    if (longestConsecutive > maxConsecutive) {
      return [
        {
          type: ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
          severity: ConflictSeverity.WARNING,
          message: `Giáo viên dạy quá ${maxConsecutive} tiết liên tiếp trong ngày`,
          details: {
            currentCount: longestConsecutive,
            maxAllowed: maxConsecutive,
            teacherId: target.teacherId,
            dayOfWeek: target.dayOfWeek,
          },
        },
      ];
    }

    return [];
  }

  private findLongestConsecutive(sortedOrders: number[]): number {
    if (sortedOrders.length === 0) {
      return 0;
    }

    let longest = 1;
    let current = 1;

    for (let i = 1; i < sortedOrders.length; i++) {
      if (sortedOrders[i] - sortedOrders[i - 1] === 1) {
        current++;
      } else {
        current = 1;
      }
      if (current > longest) {
        longest = current;
      }
    }

    return longest;
  }
}
