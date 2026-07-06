/**
 * Feature: conflict-detection, Properties 7-11: Soft constraint checkers
 *
 * **Validates: Requirements 4.1, 4.2, 5.1, 5.3, 6.1, 6.2, 7.1, 7.2**
 *
 * Property 7: Consecutive Period Threshold
 * Property 8: Travel Time — Different Campus Triggers Warning
 * Property 9: Travel Time — Same Campus No Warning
 * Property 10: Subject Consecutive Days Detection
 * Property 11: Teacher Max Periods Per Day Threshold
 */
import * as fc from 'fast-check';
import { TeacherMaxConsecutiveChecker } from '../services/checkers/teacher-max-consecutive.checker';
import { TeacherTravelTimeChecker } from '../services/checkers/teacher-travel-time.checker';
import { SubjectConsecutiveDaysChecker } from '../services/checkers/subject-consecutive-days.checker';
import { TeacherMaxPerDayChecker } from '../services/checkers/teacher-max-per-day.checker';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../enums/conflict.enum';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';

// --- Shared Generators ---
const uuidArb = fc.uuid();
const dayOfWeekArb = fc.integer({ min: 2, max: 7 });
const periodOrderArb = fc.integer({ min: 1, max: 12 });
const campusIdArb = fc.uuid();

/**
 * Helper to build a minimal ConflictIndexes with only the fields needed for a given test.
 */
function buildEmptyIndexes(): ConflictIndexes {
  return {
    teacherTimeslot: new Map(),
    roomTimeslot: new Map(),
    classTimeslot: new Map(),
    teacherDayPeriods: new Map(),
    subjectDays: new Map(),
    teacherDaySlots: new Map(),
    periodOrderMap: new Map(),
    roomCampusMap: new Map(),
  };
}

describe('Feature: conflict-detection, Property 7: Consecutive Period Threshold', () => {
  let checker: TeacherMaxConsecutiveChecker;

  beforeEach(() => {
    checker = new TeacherMaxConsecutiveChecker();
  });

  it('SHALL return TEACHER_MAX_CONSECUTIVE_EXCEEDED when K consecutive periods > 4 (maxConsecutive)', () => {
    fc.assert(
      fc.property(
        uuidArb, // teacherId
        dayOfWeekArb, // dayOfWeek
        uuidArb, // periodId for target
        uuidArb, // versionId
        uuidArb, // classId
        uuidArb, // subjectId
        fc.integer({ min: 5, max: 12 }), // K consecutive periods (> 4)
        fc.integer({ min: 1, max: 8 }), // startOrder
        (
          teacherId,
          dayOfWeek,
          periodId,
          versionId,
          classId,
          subjectId,
          k,
          startOrder,
        ) => {
          // Ensure we don't overflow period order 12
          const adjustedStart = Math.min(startOrder, 12 - k + 1);
          if (adjustedStart < 1) return; // skip if impossible

          // Existing periods: K-1 consecutive starting from adjustedStart
          const existingOrders: number[] = [];
          for (let i = 0; i < k - 1; i++) {
            existingOrders.push(adjustedStart + i);
          }

          // Target period order is the next consecutive one
          const targetOrder = adjustedStart + k - 1;

          const indexes = buildEmptyIndexes();
          const key = `${teacherId}-${dayOfWeek}`;
          indexes.teacherDayPeriods.set(key, existingOrders);
          indexes.periodOrderMap.set(periodId, targetOrder);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek,
            periodId,
            teacherId,
            classId,
            roomId: null,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          expect(conflicts.length).toBe(1);
          expect(conflicts[0].type).toBe(
            ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
          );
          expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
          expect(conflicts[0].details.currentCount).toBe(k);
          expect(conflicts[0].details.maxAllowed).toBe(4);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SHALL NOT return warning when K ≤ 4 consecutive periods', () => {
    fc.assert(
      fc.property(
        uuidArb, // teacherId
        dayOfWeekArb, // dayOfWeek
        uuidArb, // periodId for target
        uuidArb, // versionId
        uuidArb, // classId
        uuidArb, // subjectId
        fc.integer({ min: 1, max: 4 }), // K consecutive periods (≤ 4)
        fc.integer({ min: 1, max: 9 }), // startOrder
        (
          teacherId,
          dayOfWeek,
          periodId,
          versionId,
          classId,
          subjectId,
          k,
          startOrder,
        ) => {
          // Ensure we don't overflow
          const adjustedStart = Math.min(startOrder, 12 - k + 1);
          if (adjustedStart < 1) return;

          // Existing periods: K-1 consecutive starting from adjustedStart
          const existingOrders: number[] = [];
          for (let i = 0; i < k - 1; i++) {
            existingOrders.push(adjustedStart + i);
          }

          // Target period is the next consecutive one (total = K)
          const targetOrder = adjustedStart + k - 1;

          const indexes = buildEmptyIndexes();
          const key = `${teacherId}-${dayOfWeek}`;
          indexes.teacherDayPeriods.set(key, existingOrders);
          indexes.periodOrderMap.set(periodId, targetOrder);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek,
            periodId,
            teacherId,
            classId,
            roomId: null,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          expect(conflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SHALL NOT return warning when periods are non-consecutive (with gaps) even if count > 4', () => {
    fc.assert(
      fc.property(
        uuidArb, // teacherId
        dayOfWeekArb, // dayOfWeek
        uuidArb, // periodId for target
        uuidArb, // versionId
        uuidArb, // classId
        uuidArb, // subjectId
        (teacherId, dayOfWeek, periodId, versionId, classId, subjectId) => {
          // Create non-consecutive periods: 1, 3, 5, 7, 9 (5 periods but gaps)
          const existingOrders = [1, 3, 5, 7];
          const targetOrder = 9;

          const indexes = buildEmptyIndexes();
          const key = `${teacherId}-${dayOfWeek}`;
          indexes.teacherDayPeriods.set(key, existingOrders);
          indexes.periodOrderMap.set(periodId, targetOrder);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek,
            periodId,
            teacherId,
            classId,
            roomId: null,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          // No consecutive warning since max consecutive sequence is 1
          expect(conflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: conflict-detection, Property 8: Travel Time — Different Campus Triggers Warning', () => {
  let checker: TeacherTravelTimeChecker;

  beforeEach(() => {
    checker = new TeacherTravelTimeChecker();
  });

  it('SHALL return TEACHER_INSUFFICIENT_TRAVEL_TIME when adjacent slots at different campuses', () => {
    fc.assert(
      fc.property(
        uuidArb, // teacherId
        dayOfWeekArb, // dayOfWeek
        uuidArb, // target periodId
        uuidArb, // existing slot periodId
        uuidArb, // target roomId
        uuidArb, // existing roomId
        campusIdArb, // campus A
        campusIdArb, // campus B
        periodOrderArb, // base period order
        uuidArb, // versionId
        uuidArb, // classId
        uuidArb, // subjectId
        uuidArb, // existing slot id
        (
          teacherId,
          dayOfWeek,
          targetPeriodId,
          existingPeriodId,
          targetRoomId,
          existingRoomId,
          campusA,
          campusB,
          basePeriodOrder,
          versionId,
          classId,
          subjectId,
          existingSlotId,
        ) => {
          // Ensure different campuses
          if (campusA === campusB) return;
          // Ensure different period IDs
          if (targetPeriodId === existingPeriodId) return;
          // Ensure adjacent period orders
          if (basePeriodOrder >= 12) return;

          const targetOrder = basePeriodOrder;
          const existingOrder = basePeriodOrder + 1;

          const indexes = buildEmptyIndexes();
          indexes.periodOrderMap.set(targetPeriodId, targetOrder);
          indexes.periodOrderMap.set(existingPeriodId, existingOrder);
          indexes.roomCampusMap.set(targetRoomId, campusA);
          indexes.roomCampusMap.set(existingRoomId, campusB);

          // Create existing slot in teacherDaySlots
          const existingSlot = {
            id: existingSlotId,
            periodId: existingPeriodId,
            roomId: existingRoomId,
            teacherId,
            dayOfWeek,
          } as TimetableSlotEntity;

          const key = `${teacherId}-${dayOfWeek}`;
          indexes.teacherDaySlots.set(key, [existingSlot]);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek,
            periodId: targetPeriodId,
            teacherId,
            classId,
            roomId: targetRoomId,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          expect(conflicts.length).toBeGreaterThanOrEqual(1);
          expect(conflicts[0].type).toBe(
            ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME,
          );
          expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
          expect(conflicts[0].details.campusFrom).toBe(campusB);
          expect(conflicts[0].details.campusTo).toBe(campusA);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: conflict-detection, Property 9: Travel Time — Same Campus No Warning', () => {
  let checker: TeacherTravelTimeChecker;

  beforeEach(() => {
    checker = new TeacherTravelTimeChecker();
  });

  it('SHALL NOT return travel time warning when adjacent slots at same campus', () => {
    fc.assert(
      fc.property(
        uuidArb, // teacherId
        dayOfWeekArb, // dayOfWeek
        uuidArb, // target periodId
        uuidArb, // existing slot periodId
        uuidArb, // target roomId
        uuidArb, // existing roomId
        campusIdArb, // same campus for both
        periodOrderArb, // base period order
        uuidArb, // versionId
        uuidArb, // classId
        uuidArb, // subjectId
        uuidArb, // existing slot id
        (
          teacherId,
          dayOfWeek,
          targetPeriodId,
          existingPeriodId,
          targetRoomId,
          existingRoomId,
          sameCampus,
          basePeriodOrder,
          versionId,
          classId,
          subjectId,
          existingSlotId,
        ) => {
          // Ensure different period IDs
          if (targetPeriodId === existingPeriodId) return;
          if (basePeriodOrder >= 12) return;

          const targetOrder = basePeriodOrder;
          const existingOrder = basePeriodOrder + 1;

          const indexes = buildEmptyIndexes();
          indexes.periodOrderMap.set(targetPeriodId, targetOrder);
          indexes.periodOrderMap.set(existingPeriodId, existingOrder);
          // Both rooms map to the SAME campus
          indexes.roomCampusMap.set(targetRoomId, sameCampus);
          indexes.roomCampusMap.set(existingRoomId, sameCampus);

          // Create existing slot in teacherDaySlots
          const existingSlot = {
            id: existingSlotId,
            periodId: existingPeriodId,
            roomId: existingRoomId,
            teacherId,
            dayOfWeek,
          } as TimetableSlotEntity;

          const key = `${teacherId}-${dayOfWeek}`;
          indexes.teacherDaySlots.set(key, [existingSlot]);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek,
            periodId: targetPeriodId,
            teacherId,
            classId,
            roomId: targetRoomId,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          // No travel time warning when same campus
          const travelConflicts = conflicts.filter(
            (c) => c.type === ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME,
          );
          expect(travelConflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: conflict-detection, Property 10: Subject Consecutive Days Detection', () => {
  let checker: SubjectConsecutiveDaysChecker;

  beforeEach(() => {
    checker = new SubjectConsecutiveDaysChecker();
  });

  it('SHALL return SUBJECT_CONSECUTIVE_DAYS when same subject for same class on adjacent days', () => {
    fc.assert(
      fc.property(
        uuidArb, // classId
        uuidArb, // subjectId
        uuidArb, // teacherId
        uuidArb, // periodId
        uuidArb, // versionId
        fc.integer({ min: 2, max: 6 }), // existing day (2-6 so adjacent day+1 still in range)
        (classId, subjectId, teacherId, periodId, versionId, existingDay) => {
          const targetDay = existingDay + 1; // adjacent day

          const indexes = buildEmptyIndexes();
          const key = `${classId}-${subjectId}`;
          indexes.subjectDays.set(key, [existingDay]);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek: targetDay,
            periodId,
            teacherId,
            classId,
            roomId: null,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          expect(conflicts.length).toBe(1);
          expect(conflicts[0].type).toBe(ConflictType.SUBJECT_CONSECUTIVE_DAYS);
          expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
          expect(conflicts[0].details.affectedDays).toContain(existingDay);
          expect(conflicts[0].details.affectedDays).toContain(targetDay);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SHALL NOT return warning when days are non-adjacent (|d1 - d2| > 1)', () => {
    fc.assert(
      fc.property(
        uuidArb, // classId
        uuidArb, // subjectId
        uuidArb, // teacherId
        uuidArb, // periodId
        uuidArb, // versionId
        dayOfWeekArb, // existing day
        dayOfWeekArb, // target day
        (
          classId,
          subjectId,
          teacherId,
          periodId,
          versionId,
          existingDay,
          targetDay,
        ) => {
          // Only test non-adjacent days
          if (Math.abs(existingDay - targetDay) <= 1) return;

          const indexes = buildEmptyIndexes();
          const key = `${classId}-${subjectId}`;
          indexes.subjectDays.set(key, [existingDay]);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek: targetDay,
            periodId,
            teacherId,
            classId,
            roomId: null,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          const consecutiveDayConflicts = conflicts.filter(
            (c) => c.type === ConflictType.SUBJECT_CONSECUTIVE_DAYS,
          );
          expect(consecutiveDayConflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: conflict-detection, Property 11: Teacher Max Periods Per Day Threshold', () => {
  let checker: TeacherMaxPerDayChecker;

  beforeEach(() => {
    checker = new TeacherMaxPerDayChecker();
  });

  it('SHALL return TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED when total > 8 (max_periods_per_day)', () => {
    fc.assert(
      fc.property(
        uuidArb, // teacherId
        dayOfWeekArb, // dayOfWeek
        uuidArb, // periodId
        uuidArb, // versionId
        uuidArb, // classId
        uuidArb, // subjectId
        fc.integer({ min: 8, max: 12 }), // N existing periods (so total N+1 > 8)
        (
          teacherId,
          dayOfWeek,
          periodId,
          versionId,
          classId,
          subjectId,
          existingCount,
        ) => {
          // Build existing period orders (values don't matter, only count)
          const existingOrders: number[] = [];
          for (let i = 1; i <= existingCount; i++) {
            existingOrders.push(i);
          }

          const indexes = buildEmptyIndexes();
          const key = `${teacherId}-${dayOfWeek}`;
          indexes.teacherDayPeriods.set(key, existingOrders);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek,
            periodId,
            teacherId,
            classId,
            roomId: null,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          expect(conflicts.length).toBe(1);
          expect(conflicts[0].type).toBe(
            ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED,
          );
          expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
          expect(conflicts[0].details.currentCount).toBe(existingCount + 1);
          expect(conflicts[0].details.maxAllowed).toBe(8);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SHALL NOT return warning when total ≤ 8 (max_periods_per_day)', () => {
    fc.assert(
      fc.property(
        uuidArb, // teacherId
        dayOfWeekArb, // dayOfWeek
        uuidArb, // periodId
        uuidArb, // versionId
        uuidArb, // classId
        uuidArb, // subjectId
        fc.integer({ min: 0, max: 7 }), // N existing periods (so total N+1 ≤ 8)
        (
          teacherId,
          dayOfWeek,
          periodId,
          versionId,
          classId,
          subjectId,
          existingCount,
        ) => {
          const existingOrders: number[] = [];
          for (let i = 1; i <= existingCount; i++) {
            existingOrders.push(i);
          }

          const indexes = buildEmptyIndexes();
          const key = `${teacherId}-${dayOfWeek}`;
          indexes.teacherDayPeriods.set(key, existingOrders);

          const target: SlotCheckPayload = {
            versionId,
            dayOfWeek,
            periodId,
            teacherId,
            classId,
            roomId: null,
            subjectId,
          };

          const conflicts = checker.check(target, indexes);

          expect(conflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
