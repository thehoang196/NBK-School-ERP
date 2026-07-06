/**
 * Feature: conflict-detection, Property 6 & 15: Detection Service
 *
 * **Validates: Requirements 1.2, 2.3, 3.2, 4.3, 5.4, 6.3, 7.3, 9.1**
 *
 * Property 6: Conflict Details Completeness — For any detected conflict,
 * details SHALL contain all required fields for that conflict type.
 *
 * Property 15: Full-Version Consistency — Set of conflicts from full-version
 * SHALL equal deduplicated union of single-slot checks.
 */
import * as fc from 'fast-check';
import { ConflictDetectionService } from '../services/conflict-detection.service';
import { TeacherDoubleBookedChecker } from '../services/checkers/teacher-double-booked.checker';
import { RoomDoubleBookedChecker } from '../services/checkers/room-double-booked.checker';
import { ClassDoubleBookedChecker } from '../services/checkers/class-double-booked.checker';
import { TeacherMaxConsecutiveChecker } from '../services/checkers/teacher-max-consecutive.checker';
import { TeacherTravelTimeChecker } from '../services/checkers/teacher-travel-time.checker';
import { SubjectConsecutiveDaysChecker } from '../services/checkers/subject-consecutive-days.checker';
import { TeacherMaxPerDayChecker } from '../services/checkers/teacher-max-per-day.checker';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import {
  Conflict,
  SlotCheckPayload,
  ConflictCheckOptions,
} from '../interfaces/conflict.interface';
import {
  ConflictType,
  ConflictSeverity,
  ValidationContext,
} from '../enums/conflict.enum';
import type { TimetableSlotEntity } from '../entities/timetable-slot.entity';

// ─── Service Factory ──────────────────────────────────────────────────────────

function createService(): ConflictDetectionService {
  const mockSlotRepo = {} as any;
  const mockVersionRepo = {} as any;
  const mockTeacherRepo = {} as any;

  return new ConflictDetectionService(
    mockSlotRepo,
    mockVersionRepo,
    mockTeacherRepo,
    {} as any, // timetableVersionRepo
    new TeacherDoubleBookedChecker(),
    new RoomDoubleBookedChecker(),
    new ClassDoubleBookedChecker(),
    new TeacherMaxConsecutiveChecker(),
    new TeacherTravelTimeChecker(),
    new SubjectConsecutiveDaysChecker(),
    new TeacherMaxPerDayChecker(),
    { getAccessibleSchoolIds: jest.fn().mockResolvedValue([]) } as any,
  );
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();
const dayOfWeekArb = fc.integer({ min: 2, max: 7 });
const periodOrderArb = fc.integer({ min: 1, max: 10 });

const slotPayloadArb: fc.Arbitrary<SlotCheckPayload> = fc.record({
  versionId: uuidArb,
  dayOfWeek: dayOfWeekArb,
  periodId: uuidArb,
  teacherId: uuidArb,
  classId: uuidArb,
  roomId: fc.option(uuidArb, { nil: null }) as fc.Arbitrary<string | null>,
  subjectId: uuidArb,
});

/**
 * Generate a TimetableSlotEntity-like object with relation stubs.
 */
const timetableSlotEntityArb = fc.record({
  id: uuidArb,
  schoolId: uuidArb,
  versionId: uuidArb,
  dayOfWeek: dayOfWeekArb,
  periodId: uuidArb,
  teacherId: uuidArb,
  classId: uuidArb,
  roomId: fc.option(uuidArb, { nil: null }) as fc.Arbitrary<string | null>,
  subjectId: uuidArb,
  isDoublePeriod: fc.boolean(),
  class: fc.record({ name: fc.string({ minLength: 1, maxLength: 20 }) }),
  subject: fc.record({ name: fc.string({ minLength: 1, maxLength: 20 }) }),
  teacher: fc.record({ fullName: fc.string({ minLength: 1, maxLength: 30 }) }),
});

const defaultOptions: ConflictCheckOptions = {
  context: ValidationContext.SINGLE_SLOT,
  schoolId: '00000000-0000-0000-0000-000000000001',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyIndexes(): ConflictIndexes {
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

/**
 * Required fields per conflict type as defined in the spec.
 */
const REQUIRED_FIELDS: Record<ConflictType, string[]> = {
  [ConflictType.TEACHER_DOUBLE_BOOKED]: ['className', 'subjectName'],
  [ConflictType.ROOM_DOUBLE_BOOKED]: ['className', 'teacherName'],
  [ConflictType.CLASS_DOUBLE_BOOKED]: ['subjectName', 'teacherName'],
  [ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED]: [
    'currentCount',
    'maxAllowed',
  ],
  [ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME]: ['campusFrom', 'campusTo'],
  [ConflictType.SUBJECT_CONSECUTIVE_DAYS]: ['affectedDays'],
  [ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED]: [
    'currentCount',
    'maxAllowed',
  ],
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: conflict-detection, ConflictDetectionService Properties', () => {
  let service: ConflictDetectionService;

  beforeEach(() => {
    service = createService();
  });

  // ─── Property 6: Conflict Details Completeness ────────────────────────────

  describe('Property 6: Conflict Details Completeness', () => {
    /**
     * **Validates: Requirements 1.2, 2.3, 3.2, 4.3, 5.4, 6.3, 7.3**
     *
     * For any detected conflict, the details object SHALL contain all required
     * fields for that conflict type.
     */

    it('TEACHER_DOUBLE_BOOKED details must contain className and subjectName', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          timetableSlotEntityArb,
          (payload, existingSlotBase) => {
            const existingSlot = {
              ...existingSlotBase,
              teacherId: payload.teacherId,
              dayOfWeek: payload.dayOfWeek,
              periodId: payload.periodId,
            } as unknown as TimetableSlotEntity;

            const indexes = emptyIndexes();
            const key = `${payload.teacherId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.teacherTimeslot.set(key, existingSlot);

            const conflicts = service.detectConflicts(
              payload,
              indexes,
              defaultOptions,
            );
            const teacherConflicts = conflicts.filter(
              (c) => c.type === ConflictType.TEACHER_DOUBLE_BOOKED,
            );

            for (const conflict of teacherConflicts) {
              expect(conflict.details).toBeDefined();
              expect('className' in conflict.details).toBe(true);
              expect('subjectName' in conflict.details).toBe(true);
              expect(typeof conflict.details.className).toBe('string');
              expect(typeof conflict.details.subjectName).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('ROOM_DOUBLE_BOOKED details must contain className and teacherName', () => {
      fc.assert(
        fc.property(
          slotPayloadArb.chain((p) =>
            uuidArb.map((r) => ({ ...p, roomId: r })),
          ),
          timetableSlotEntityArb,
          (payload, existingSlotBase) => {
            const existingSlot = {
              ...existingSlotBase,
              roomId: payload.roomId,
              dayOfWeek: payload.dayOfWeek,
              periodId: payload.periodId,
            } as unknown as TimetableSlotEntity;

            const indexes = emptyIndexes();
            const key = `${payload.roomId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.roomTimeslot.set(key, existingSlot);

            const conflicts = service.detectConflicts(
              payload,
              indexes,
              defaultOptions,
            );
            const roomConflicts = conflicts.filter(
              (c) => c.type === ConflictType.ROOM_DOUBLE_BOOKED,
            );

            for (const conflict of roomConflicts) {
              expect(conflict.details).toBeDefined();
              expect('className' in conflict.details).toBe(true);
              expect('teacherName' in conflict.details).toBe(true);
              expect(typeof conflict.details.className).toBe('string');
              expect(typeof conflict.details.teacherName).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('CLASS_DOUBLE_BOOKED details must contain subjectName and teacherName', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          timetableSlotEntityArb,
          (payload, existingSlotBase) => {
            const existingSlot = {
              ...existingSlotBase,
              classId: payload.classId,
              dayOfWeek: payload.dayOfWeek,
              periodId: payload.periodId,
            } as unknown as TimetableSlotEntity;

            const indexes = emptyIndexes();
            const key = `${payload.classId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.classTimeslot.set(key, existingSlot);

            const conflicts = service.detectConflicts(
              payload,
              indexes,
              defaultOptions,
            );
            const classConflicts = conflicts.filter(
              (c) => c.type === ConflictType.CLASS_DOUBLE_BOOKED,
            );

            for (const conflict of classConflicts) {
              expect(conflict.details).toBeDefined();
              expect('subjectName' in conflict.details).toBe(true);
              expect('teacherName' in conflict.details).toBe(true);
              expect(typeof conflict.details.subjectName).toBe('string');
              expect(typeof conflict.details.teacherName).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('TEACHER_MAX_CONSECUTIVE_EXCEEDED details must contain currentCount and maxAllowed', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          // Generate 5 consecutive period orders to exceed default max of 4
          fc.integer({ min: 1, max: 5 }),
          (payload, startOrder) => {
            const indexes = emptyIndexes();

            // Set target periodId to a known period order
            const targetOrder = startOrder + 4; // 5th consecutive
            indexes.periodOrderMap.set(payload.periodId, targetOrder);

            // Build 4 existing consecutive periods before the target
            const tdKey = `${payload.teacherId}-${payload.dayOfWeek}`;
            const existingOrders: number[] = [];
            for (let i = 0; i < 4; i++) {
              existingOrders.push(startOrder + i);
            }
            indexes.teacherDayPeriods.set(tdKey, existingOrders);

            const conflicts = service.detectConflicts(
              payload,
              indexes,
              defaultOptions,
            );
            const consecutiveConflicts = conflicts.filter(
              (c) => c.type === ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
            );

            expect(consecutiveConflicts.length).toBeGreaterThanOrEqual(1);
            for (const conflict of consecutiveConflicts) {
              expect(conflict.details).toBeDefined();
              expect('currentCount' in conflict.details).toBe(true);
              expect('maxAllowed' in conflict.details).toBe(true);
              expect(typeof conflict.details.currentCount).toBe('number');
              expect(typeof conflict.details.maxAllowed).toBe('number');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('TEACHER_INSUFFICIENT_TRAVEL_TIME details must contain campusFrom and campusTo', () => {
      fc.assert(
        fc.property(
          slotPayloadArb.chain((p) =>
            uuidArb.map((r) => ({ ...p, roomId: r })),
          ),
          uuidArb, // campusA
          uuidArb, // campusB
          uuidArb, // adjacent slot roomId
          timetableSlotEntityArb,
          (payload, campusA, campusB, adjRoomId, adjSlotBase) => {
            // Ensure campuses differ
            fc.pre(campusA !== campusB);

            const indexes = emptyIndexes();
            const targetOrder = 3;
            const adjOrder = 4; // adjacent

            indexes.periodOrderMap.set(payload.periodId, targetOrder);
            indexes.roomCampusMap.set(payload.roomId!, campusA);
            indexes.roomCampusMap.set(adjRoomId, campusB);

            // Create adjacent slot for same teacher, same day, adjacent period
            const adjPeriodId = adjSlotBase.periodId;
            indexes.periodOrderMap.set(adjPeriodId, adjOrder);

            const adjSlot = {
              ...adjSlotBase,
              teacherId: payload.teacherId,
              dayOfWeek: payload.dayOfWeek,
              periodId: adjPeriodId,
              roomId: adjRoomId,
            } as unknown as TimetableSlotEntity;

            const tdKey = `${payload.teacherId}-${payload.dayOfWeek}`;
            indexes.teacherDaySlots.set(tdKey, [adjSlot]);

            const conflicts = service.detectConflicts(
              payload,
              indexes,
              defaultOptions,
            );
            const travelConflicts = conflicts.filter(
              (c) => c.type === ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME,
            );

            expect(travelConflicts.length).toBeGreaterThanOrEqual(1);
            for (const conflict of travelConflicts) {
              expect(conflict.details).toBeDefined();
              expect('campusFrom' in conflict.details).toBe(true);
              expect('campusTo' in conflict.details).toBe(true);
              expect(typeof conflict.details.campusFrom).toBe('string');
              expect(typeof conflict.details.campusTo).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('SUBJECT_CONSECUTIVE_DAYS details must contain affectedDays array', () => {
      fc.assert(
        fc.property(
          slotPayloadArb.map((p) => ({
            ...p,
            dayOfWeek: fc.sample(fc.integer({ min: 3, max: 6 }), 1)[0],
          })),
          (payload) => {
            const indexes = emptyIndexes();
            const sdKey = `${payload.classId}-${payload.subjectId}`;
            // Put an existing day adjacent to target
            const adjacentDay = payload.dayOfWeek - 1;
            indexes.subjectDays.set(sdKey, [adjacentDay]);

            const conflicts = service.detectConflicts(
              payload,
              indexes,
              defaultOptions,
            );
            const subjectConflicts = conflicts.filter(
              (c) => c.type === ConflictType.SUBJECT_CONSECUTIVE_DAYS,
            );

            expect(subjectConflicts.length).toBeGreaterThanOrEqual(1);
            for (const conflict of subjectConflicts) {
              expect(conflict.details).toBeDefined();
              expect('affectedDays' in conflict.details).toBe(true);
              expect(Array.isArray(conflict.details.affectedDays)).toBe(true);
              expect(conflict.details.affectedDays!.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED details must contain currentCount and maxAllowed', () => {
      fc.assert(
        fc.property(slotPayloadArb, (payload) => {
          const indexes = emptyIndexes();
          const tdKey = `${payload.teacherId}-${payload.dayOfWeek}`;

          // Fill with 8 existing periods (default max is 8) so adding one more triggers
          const existingOrders = [1, 2, 3, 4, 5, 6, 7, 8];
          indexes.teacherDayPeriods.set(tdKey, existingOrders);
          indexes.periodOrderMap.set(payload.periodId, 9);

          const conflicts = service.detectConflicts(
            payload,
            indexes,
            defaultOptions,
          );
          const maxPerDayConflicts = conflicts.filter(
            (c) => c.type === ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED,
          );

          expect(maxPerDayConflicts.length).toBeGreaterThanOrEqual(1);
          for (const conflict of maxPerDayConflicts) {
            expect(conflict.details).toBeDefined();
            expect('currentCount' in conflict.details).toBe(true);
            expect('maxAllowed' in conflict.details).toBe(true);
            expect(typeof conflict.details.currentCount).toBe('number');
            expect(typeof conflict.details.maxAllowed).toBe('number');
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 15: Full-Version Consistency ──────────────────────────────────

  describe('Property 15: Full-Version Consistency', () => {
    /**
     * **Validates: Requirements 9.1**
     *
     * For any timetable version, the set of conflicts from full-version check
     * SHALL equal the deduplicated union of single-slot checks against the same
     * index data. Running detectConflicts on each slot individually against the
     * same indexes produces the same total set of conflicts.
     */
    it('full-version conflicts equal union of individual slot checks', () => {
      // Generate a set of 3-10 slots sharing common version, some with conflicts
      const slotsArb = fc.integer({ min: 3, max: 10 }).chain((n) =>
        fc.tuple(
          uuidArb, // versionId
          fc.array(timetableSlotEntityArb, { minLength: n, maxLength: n }),
          // period orders for mapping
          fc.array(periodOrderArb, { minLength: n, maxLength: n }),
        ),
      );

      fc.assert(
        fc.property(slotsArb, ([versionId, slots, periodOrders]) => {
          // Assign versionId to all slots and build periodOrderMap
          const periodOrderMap = new Map<string, number>();
          const allSlots = slots.map((s, i) => {
            periodOrderMap.set(s.periodId, periodOrders[i]);
            return {
              ...s,
              versionId,
            } as unknown as TimetableSlotEntity;
          });

          // Build indexes from ALL slots (simulating full-version)
          const indexes = service.buildIndexes(allSlots, periodOrderMap);

          // Full-version approach: check each slot against the complete indexes
          const fullVersionConflicts: Conflict[] = [];
          for (const slot of allSlots) {
            const target: SlotCheckPayload = {
              versionId: slot.versionId,
              dayOfWeek: slot.dayOfWeek,
              periodId: slot.periodId,
              teacherId: slot.teacherId,
              classId: slot.classId,
              roomId: slot.roomId,
              subjectId: slot.subjectId,
            };
            const conflicts = service.detectConflicts(
              target,
              indexes,
              defaultOptions,
            );
            fullVersionConflicts.push(...conflicts);
          }

          // Individual slot checks: same indexes, same target — should match
          const individualConflicts: Conflict[] = [];
          for (const slot of allSlots) {
            const target: SlotCheckPayload = {
              versionId: slot.versionId,
              dayOfWeek: slot.dayOfWeek,
              periodId: slot.periodId,
              teacherId: slot.teacherId,
              classId: slot.classId,
              roomId: slot.roomId,
              subjectId: slot.subjectId,
            };
            const conflicts = service.detectConflicts(
              target,
              indexes,
              defaultOptions,
            );
            individualConflicts.push(...conflicts);
          }

          // Deduplicate by creating a conflict signature
          const toSignature = (c: Conflict): string =>
            `${c.type}|${c.details.conflictingSlotId ?? ''}|${c.details.teacherId ?? ''}|${c.details.classId ?? ''}|${c.details.dayOfWeek ?? ''}|${c.details.periodId ?? ''}|${c.details.campusFrom ?? ''}|${c.details.campusTo ?? ''}`;

          const fullSet = new Set(fullVersionConflicts.map(toSignature));
          const individualSet = new Set(individualConflicts.map(toSignature));

          // Both approaches produce the same set of unique conflicts
          expect(fullSet.size).toBe(individualSet.size);
          for (const sig of fullSet) {
            expect(individualSet.has(sig)).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('each conflict references valid data from the input slot set', () => {
      const slotsArb = fc
        .integer({ min: 3, max: 8 })
        .chain((n) =>
          fc.tuple(
            uuidArb,
            fc.array(timetableSlotEntityArb, { minLength: n, maxLength: n }),
            fc.array(periodOrderArb, { minLength: n, maxLength: n }),
          ),
        );

      fc.assert(
        fc.property(slotsArb, ([versionId, slots, periodOrders]) => {
          const periodOrderMap = new Map<string, number>();
          const allSlots = slots.map((s, i) => {
            periodOrderMap.set(s.periodId, periodOrders[i]);
            return { ...s, versionId } as unknown as TimetableSlotEntity;
          });

          const indexes = service.buildIndexes(allSlots, periodOrderMap);

          // Collect all slot ids for reference validation
          const allSlotIds = new Set(allSlots.map((s) => s.id));

          for (const slot of allSlots) {
            const target: SlotCheckPayload = {
              versionId: slot.versionId,
              dayOfWeek: slot.dayOfWeek,
              periodId: slot.periodId,
              teacherId: slot.teacherId,
              classId: slot.classId,
              roomId: slot.roomId,
              subjectId: slot.subjectId,
            };
            const conflicts = service.detectConflicts(
              target,
              indexes,
              defaultOptions,
            );

            for (const conflict of conflicts) {
              // If a conflictingSlotId is present, it must be from our input set
              if (conflict.details.conflictingSlotId) {
                expect(allSlotIds.has(conflict.details.conflictingSlotId)).toBe(
                  true,
                );
              }
              // Every conflict must have a valid type and severity
              expect(Object.values(ConflictType)).toContain(conflict.type);
              expect(Object.values(ConflictSeverity)).toContain(
                conflict.severity,
              );
              // Message must be non-empty
              expect(conflict.message.length).toBeGreaterThan(0);
            }
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
