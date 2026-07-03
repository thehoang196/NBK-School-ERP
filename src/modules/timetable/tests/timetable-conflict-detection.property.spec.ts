/**
 * Feature: timetable-management-features, Property 11: Conflict detection accuracy
 *
 * **Validates: Requirements 4.3**
 *
 * Property: For any slot configuration in a version, if two slots share
 * the same (dayOfWeek, periodId) and the same teacherId, the conflict
 * detector SHALL report a TEACHER_CONFLICT. Similarly, if two slots share
 * the same (dayOfWeek, periodId, roomId) where roomId is not null, a
 * ROOM_CONFLICT SHALL be reported.
 */
import * as fc from 'fast-check';
import { ConflictDetectionService, ConflictType } from '../services/conflict-detection.service';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { Repository } from 'typeorm';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';

describe('Feature: timetable-management-features, Property 11: Conflict detection accuracy', () => {
  let service: ConflictDetectionService;
  let mockSlotRepository: Record<string, jest.Mock>;
  let mockTeacherRepo: Record<string, jest.Mock>;

  // Arbitrary: generate a valid UUID v4
  const uuidArb = fc.uuid();

  // Arbitrary: generate dayOfWeek (2-7, Monday to Saturday in Vietnam)
  const dayOfWeekArb = fc.integer({ min: 2, max: 7 });

  // Arbitrary: generate a basic slot-like object
  const slotArb = fc.record({
    id: uuidArb,
    versionId: uuidArb,
    dayOfWeek: dayOfWeekArb,
    periodId: uuidArb,
    classId: uuidArb,
    teacherId: uuidArb,
    subjectId: uuidArb,
    roomId: fc.option(fc.uuid(), { nil: null }),
    isDoublePeriod: fc.boolean(),
  });

  beforeEach(() => {
    mockSlotRepository = {
      findByVersion: jest.fn(),
      findConflicts: jest.fn(),
      findByQuery: jest.fn(),
    };
    mockTeacherRepo = {
      findOne: jest.fn(),
    };

    service = new ConflictDetectionService(
      mockSlotRepository as unknown as TimetableSlotRepository,
      mockTeacherRepo as unknown as Repository<TeacherEntity>,
    );
  });

  it('should detect TEACHER_CONFLICT when two slots share same (dayOfWeek, periodId, teacherId)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb, // versionId
        dayOfWeekArb, // shared dayOfWeek
        uuidArb, // shared periodId
        uuidArb, // shared teacherId
        uuidArb, // slot1 id
        uuidArb, // slot2 id
        uuidArb, // class1
        uuidArb, // class2
        uuidArb, // subject1
        uuidArb, // subject2
        async (
          versionId: string,
          dayOfWeek: number,
          periodId: string,
          teacherId: string,
          slot1Id: string,
          slot2Id: string,
          class1Id: string,
          class2Id: string,
          subject1Id: string,
          subject2Id: string,
        ) => {
          // Build two slots with SAME dayOfWeek, periodId, teacherId (→ teacher conflict)
          const slot1: Partial<TimetableSlotEntity> = {
            id: slot1Id,
            versionId,
            dayOfWeek,
            periodId,
            classId: class1Id,
            teacherId,
            subjectId: subject1Id,
            roomId: null,
            isDoublePeriod: false,
          };
          const slot2: Partial<TimetableSlotEntity> = {
            id: slot2Id,
            versionId,
            dayOfWeek,
            periodId,
            classId: class2Id,
            teacherId,
            subjectId: subject2Id,
            roomId: null,
            isDoublePeriod: false,
          };

          mockSlotRepository.findByVersion.mockResolvedValue([slot1, slot2]);

          const conflicts = await service.checkAllConflicts(versionId);

          // Must detect at least one TEACHER_CONFLICT
          const teacherConflicts = conflicts.filter(
            (c) => c.type === ConflictType.TEACHER_CONFLICT,
          );
          expect(teacherConflicts.length).toBeGreaterThanOrEqual(1);

          // Verify the conflict references the correct teacherId
          const hasCorrectTeacher = teacherConflicts.some(
            (c) => c.details.teacherId === teacherId,
          );
          expect(hasCorrectTeacher).toBe(true);

          // Verify the conflict references the correct dayOfWeek and periodId
          const hasCorrectTimeslot = teacherConflicts.some(
            (c) => c.details.dayOfWeek === dayOfWeek && c.details.periodId === periodId,
          );
          expect(hasCorrectTimeslot).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should detect ROOM_CONFLICT when two slots share same (dayOfWeek, periodId, roomId) where roomId is not null', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb, // versionId
        dayOfWeekArb, // shared dayOfWeek
        uuidArb, // shared periodId
        uuidArb, // shared roomId (NOT null)
        uuidArb, // slot1 id
        uuidArb, // slot2 id
        uuidArb, // teacher1
        uuidArb, // teacher2
        uuidArb, // class1
        uuidArb, // class2
        async (
          versionId: string,
          dayOfWeek: number,
          periodId: string,
          roomId: string,
          slot1Id: string,
          slot2Id: string,
          teacher1Id: string,
          teacher2Id: string,
          class1Id: string,
          class2Id: string,
        ) => {
          // Build two slots with SAME dayOfWeek, periodId, roomId (non-null → room conflict)
          const slot1: Partial<TimetableSlotEntity> = {
            id: slot1Id,
            versionId,
            dayOfWeek,
            periodId,
            classId: class1Id,
            teacherId: teacher1Id,
            subjectId: fc.sample(uuidArb, 1)[0],
            roomId,
            isDoublePeriod: false,
          };
          const slot2: Partial<TimetableSlotEntity> = {
            id: slot2Id,
            versionId,
            dayOfWeek,
            periodId,
            classId: class2Id,
            teacherId: teacher2Id,
            subjectId: fc.sample(uuidArb, 1)[0],
            roomId,
            isDoublePeriod: false,
          };

          mockSlotRepository.findByVersion.mockResolvedValue([slot1, slot2]);

          const conflicts = await service.checkAllConflicts(versionId);

          // Must detect at least one ROOM_CONFLICT
          const roomConflicts = conflicts.filter(
            (c) => c.type === ConflictType.ROOM_CONFLICT,
          );
          expect(roomConflicts.length).toBeGreaterThanOrEqual(1);

          // Verify the conflict references the correct roomId
          const hasCorrectRoom = roomConflicts.some(
            (c) => c.details.roomId === roomId,
          );
          expect(hasCorrectRoom).toBe(true);

          // Verify the conflict references the correct dayOfWeek and periodId
          const hasCorrectTimeslot = roomConflicts.some(
            (c) => c.details.dayOfWeek === dayOfWeek && c.details.periodId === periodId,
          );
          expect(hasCorrectTimeslot).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should NOT report any conflicts when all slots have unique teachers and rooms per timeslot', async () => {
    // Generate a list of slots where each timeslot has unique teachers and rooms
    const noConflictSlotsArb = fc
      .array(slotArb, { minLength: 2, maxLength: 10 })
      .map((slots) => {
        // Ensure uniqueness: give each slot a different (dayOfWeek, periodId) combo
        // This guarantees no conflicts since each timeslot has exactly one slot
        return slots.map((slot, index) => ({
          ...slot,
          dayOfWeek: ((index % 6) + 2), // cycles 2-7
          periodId: `period-${index}-${slot.periodId}`,
        }));
      });

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        noConflictSlotsArb,
        async (versionId: string, slots) => {
          const slotsWithVersion = slots.map((s) => ({
            ...s,
            versionId,
          }));

          mockSlotRepository.findByVersion.mockResolvedValue(slotsWithVersion);

          const conflicts = await service.checkAllConflicts(versionId);

          // No TEACHER_CONFLICT or ROOM_CONFLICT should be reported
          const teacherConflicts = conflicts.filter(
            (c) => c.type === ConflictType.TEACHER_CONFLICT,
          );
          const roomConflicts = conflicts.filter(
            (c) => c.type === ConflictType.ROOM_CONFLICT,
          );

          expect(teacherConflicts.length).toBe(0);
          expect(roomConflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should NOT report ROOM_CONFLICT when roomId is null even if dayOfWeek and periodId match', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb, // versionId
        dayOfWeekArb, // shared dayOfWeek
        uuidArb, // shared periodId
        uuidArb, // slot1 id
        uuidArb, // slot2 id
        uuidArb, // teacher1
        uuidArb, // teacher2
        uuidArb, // class1
        uuidArb, // class2
        async (
          versionId: string,
          dayOfWeek: number,
          periodId: string,
          slot1Id: string,
          slot2Id: string,
          teacher1Id: string,
          teacher2Id: string,
          class1Id: string,
          class2Id: string,
        ) => {
          // Build two slots with SAME dayOfWeek, periodId but roomId = null
          // Different teachers to avoid teacher conflicts
          const slot1: Partial<TimetableSlotEntity> = {
            id: slot1Id,
            versionId,
            dayOfWeek,
            periodId,
            classId: class1Id,
            teacherId: teacher1Id,
            subjectId: fc.sample(uuidArb, 1)[0],
            roomId: null,
            isDoublePeriod: false,
          };
          const slot2: Partial<TimetableSlotEntity> = {
            id: slot2Id,
            versionId,
            dayOfWeek,
            periodId,
            classId: class2Id,
            teacherId: teacher2Id,
            subjectId: fc.sample(uuidArb, 1)[0],
            roomId: null,
            isDoublePeriod: false,
          };

          mockSlotRepository.findByVersion.mockResolvedValue([slot1, slot2]);

          const conflicts = await service.checkAllConflicts(versionId);

          // No ROOM_CONFLICT when roomId is null
          const roomConflicts = conflicts.filter(
            (c) => c.type === ConflictType.ROOM_CONFLICT,
          );
          expect(roomConflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
