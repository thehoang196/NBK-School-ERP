/**
 * Feature: conflict-detection, Property 1-5: Hard constraint checkers
 *
 * **Validates: Requirements 1.1, 1.3, 2.1, 2.2, 3.1**
 *
 * Tests the pure checker functions for hard constraints:
 * - TeacherDoubleBookedChecker
 * - RoomDoubleBookedChecker
 * - ClassDoubleBookedChecker
 *
 * Each checker takes a SlotCheckPayload + ConflictIndexes and returns Conflict[].
 * No database mocking needed — indexes are built manually with Map instances.
 */
import * as fc from 'fast-check';
import { TeacherDoubleBookedChecker } from '../services/checkers/teacher-double-booked.checker';
import { RoomDoubleBookedChecker } from '../services/checkers/room-double-booked.checker';
import { ClassDoubleBookedChecker } from '../services/checkers/class-double-booked.checker';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../enums/conflict.enum';
import type { TimetableSlotEntity } from '../entities/timetable-slot.entity';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();
const dayOfWeekArb = fc.integer({ min: 2, max: 7 });

/**
 * Generate a SlotCheckPayload with all required fields.
 */
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
 * Generate a mock TimetableSlotEntity-like object for use in indexes.
 * We cast to TimetableSlotEntity since checkers only access specific fields.
 */
const timetableSlotEntityArb = fc.record({
  id: uuidArb,
  dayOfWeek: dayOfWeekArb,
  periodId: uuidArb,
  teacherId: uuidArb,
  classId: uuidArb,
  roomId: fc.option(uuidArb, { nil: null }) as fc.Arbitrary<string | null>,
  subjectId: uuidArb,
  class: fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  subject: fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  teacher: fc.record({
    fullName: fc.string({ minLength: 1, maxLength: 30 }),
  }),
});

/**
 * Build an empty ConflictIndexes structure.
 */
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

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: conflict-detection, Hard Constraint Checkers', () => {
  let teacherChecker: TeacherDoubleBookedChecker;
  let roomChecker: RoomDoubleBookedChecker;
  let classChecker: ClassDoubleBookedChecker;

  beforeEach(() => {
    teacherChecker = new TeacherDoubleBookedChecker();
    roomChecker = new RoomDoubleBookedChecker();
    classChecker = new ClassDoubleBookedChecker();
  });

  // ─── Property 1: Teacher Double-Booked Detection ────────────────────────────

  describe('Property 1: Teacher Double-Booked Detection', () => {
    /**
     * **Validates: Requirements 1.1**
     *
     * For any slot with same (dayOfWeek, periodId, teacherId) as an existing slot,
     * SHALL return TEACHER_DOUBLE_BOOKED with severity ERROR.
     */
    it('should detect TEACHER_DOUBLE_BOOKED when same teacher is at same timeslot', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          timetableSlotEntityArb,
          (payload, existingSlotBase) => {
            // Force existing slot to have the SAME (teacherId, dayOfWeek, periodId)
            const existingSlot = {
              ...existingSlotBase,
              teacherId: payload.teacherId,
              dayOfWeek: payload.dayOfWeek,
              periodId: payload.periodId,
            } as unknown as TimetableSlotEntity;

            // Ensure the existing slot has a different id than any excludeSlotId
            // (no self-exclusion scenario here)
            const indexes = emptyIndexes();
            const key = `${payload.teacherId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.teacherTimeslot.set(key, existingSlot);

            const conflicts = teacherChecker.check(payload, indexes);

            expect(conflicts.length).toBe(1);
            expect(conflicts[0].type).toBe(ConflictType.TEACHER_DOUBLE_BOOKED);
            expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 2: Room Double-Booked Detection ───────────────────────────────

  describe('Property 2: Room Double-Booked Detection', () => {
    /**
     * **Validates: Requirements 2.1**
     *
     * For any slot with same (dayOfWeek, periodId, roomId) where roomId is non-null,
     * SHALL return ROOM_DOUBLE_BOOKED with severity ERROR.
     */
    it('should detect ROOM_DOUBLE_BOOKED when same room is at same timeslot', () => {
      fc.assert(
        fc.property(
          // Generate payload with guaranteed non-null roomId
          slotPayloadArb.chain((payload) =>
            uuidArb.map((roomId) => ({ ...payload, roomId })),
          ),
          timetableSlotEntityArb,
          (payload, existingSlotBase) => {
            // Force existing slot to have the SAME (roomId, dayOfWeek, periodId)
            const existingSlot = {
              ...existingSlotBase,
              roomId: payload.roomId,
              dayOfWeek: payload.dayOfWeek,
              periodId: payload.periodId,
            } as unknown as TimetableSlotEntity;

            const indexes = emptyIndexes();
            const key = `${payload.roomId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.roomTimeslot.set(key, existingSlot);

            const conflicts = roomChecker.check(payload, indexes);

            expect(conflicts.length).toBe(1);
            expect(conflicts[0].type).toBe(ConflictType.ROOM_DOUBLE_BOOKED);
            expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 3: Class Double-Booked Detection ──────────────────────────────

  describe('Property 3: Class Double-Booked Detection', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any slot with same (dayOfWeek, periodId, classId),
     * SHALL return CLASS_DOUBLE_BOOKED with severity ERROR.
     */
    it('should detect CLASS_DOUBLE_BOOKED when same class is at same timeslot', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          timetableSlotEntityArb,
          (payload, existingSlotBase) => {
            // Force existing slot to have the SAME (classId, dayOfWeek, periodId)
            const existingSlot = {
              ...existingSlotBase,
              classId: payload.classId,
              dayOfWeek: payload.dayOfWeek,
              periodId: payload.periodId,
            } as unknown as TimetableSlotEntity;

            const indexes = emptyIndexes();
            const key = `${payload.classId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.classTimeslot.set(key, existingSlot);

            const conflicts = classChecker.check(payload, indexes);

            expect(conflicts.length).toBe(1);
            expect(conflicts[0].type).toBe(ConflictType.CLASS_DOUBLE_BOOKED);
            expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 4: Null Room Skips Room Check ─────────────────────────────────

  describe('Property 4: Null Room Skips Room Check', () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * For any slot with null roomId, SHALL never return ROOM_DOUBLE_BOOKED.
     */
    it('should never return ROOM_DOUBLE_BOOKED when roomId is null', () => {
      fc.assert(
        fc.property(
          // Generate payload with null roomId
          slotPayloadArb.map((payload) => ({ ...payload, roomId: null })),
          // Generate arbitrary room data in the index (should not matter)
          fc.array(
            fc.tuple(uuidArb, dayOfWeekArb, uuidArb, timetableSlotEntityArb),
            { minLength: 0, maxLength: 5 },
          ),
          (payload, roomEntries) => {
            const indexes = emptyIndexes();

            // Fill RoomTimeslotIndex with arbitrary data
            for (const [roomId, day, periodId, slotBase] of roomEntries) {
              const slot = {
                ...slotBase,
                roomId,
                dayOfWeek: day,
                periodId,
              } as unknown as TimetableSlotEntity;
              const key = `${roomId}-${day}-${periodId}`;
              indexes.roomTimeslot.set(key, slot);
            }

            const conflicts = roomChecker.check(payload, indexes);

            // Should always be empty — null roomId means skip room check
            expect(conflicts.length).toBe(0);
            const roomConflicts = conflicts.filter(
              (c) => c.type === ConflictType.ROOM_DOUBLE_BOOKED,
            );
            expect(roomConflicts.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 5: Self-Exclusion on Update ───────────────────────────────────

  describe('Property 5: Self-Exclusion on Update', () => {
    /**
     * **Validates: Requirements 1.3**
     *
     * With excludeSlotId set, SHALL never report itself as conflicting.
     */
    it('should not report conflict when excludeSlotId matches the existing slot id', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          uuidArb, // the existing slot's id (which is also excludeSlotId)
          timetableSlotEntityArb,
          (payloadBase, existingSlotId, existingSlotBase) => {
            // Set excludeSlotId on payload
            const payload: SlotCheckPayload = {
              ...payloadBase,
              excludeSlotId: existingSlotId,
              roomId: payloadBase.roomId ?? fc.sample(uuidArb, 1)[0], // ensure non-null for room check
            };

            // Create existing slot with the SAME id as excludeSlotId
            // and matching all conflict keys
            const existingSlot = {
              ...existingSlotBase,
              id: existingSlotId,
              teacherId: payload.teacherId,
              classId: payload.classId,
              roomId: payload.roomId,
              dayOfWeek: payload.dayOfWeek,
              periodId: payload.periodId,
            } as unknown as TimetableSlotEntity;

            // Put existing slot in ALL indexes
            const indexes = emptyIndexes();
            const teacherKey = `${payload.teacherId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.teacherTimeslot.set(teacherKey, existingSlot);

            if (payload.roomId) {
              const roomKey = `${payload.roomId}-${payload.dayOfWeek}-${payload.periodId}`;
              indexes.roomTimeslot.set(roomKey, existingSlot);
            }

            const classKey = `${payload.classId}-${payload.dayOfWeek}-${payload.periodId}`;
            indexes.classTimeslot.set(classKey, existingSlot);

            // Run all checkers — none should report a conflict
            const teacherConflicts = teacherChecker.check(payload, indexes);
            const roomConflicts = roomChecker.check(payload, indexes);
            const classConflicts = classChecker.check(payload, indexes);

            // No checker should report the excluded slot as conflicting
            const allConflicts = [
              ...teacherConflicts,
              ...roomConflicts,
              ...classConflicts,
            ];

            for (const conflict of allConflicts) {
              expect(conflict.details.conflictingSlotId).not.toBe(
                existingSlotId,
              );
            }

            // In this specific case (self-exclusion), all should be empty
            expect(allConflicts.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
