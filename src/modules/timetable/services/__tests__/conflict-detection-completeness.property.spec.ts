import * as fc from 'fast-check';
import {
  ConflictDetectionService,
  PostGenerationConflictResult,
} from '../conflict-detection.service';
import { TimetableSlotEntity } from '../../entities/timetable-slot.entity';

/**
 * Property 8: Conflict Detection Completeness
 * Feature: fet-generation-pipeline
 *
 * For any set of TimetableSlot records within a version, the Conflict_Detector
 * SHALL report a conflict for every occurrence where two or more slots share the
 * same (dayOfWeek, periodId) and have the same teacherId, classId, or roomId.
 * No such double-booking SHALL go unreported.
 *
 * **Validates: Requirements 7.2**
 */
describe('Feature: fet-generation-pipeline, Property 8: Conflict Detection Completeness', () => {
  let service: ConflictDetectionService;
  let mockSlotRepository: { findByVersion: jest.Mock };
  let mockVersionRepository: { update: jest.Mock };

  beforeEach(() => {
    mockSlotRepository = {
      findByVersion: jest.fn(),
    };
    mockVersionRepository = {
      update: jest.fn().mockResolvedValue(null),
    };

    service = new ConflictDetectionService(
      mockSlotRepository as never,
      mockVersionRepository as never,
      {} as never, // teacherRepo — not used by detectPostGenerationConflicts
      {} as never, // timetableVersionRepo — not used by detectPostGenerationConflicts
      { check: jest.fn().mockReturnValue([]) } as never,
      { check: jest.fn().mockReturnValue([]) } as never,
      { check: jest.fn().mockReturnValue([]) } as never,
      { check: jest.fn().mockReturnValue([]) } as never,
      { check: jest.fn().mockReturnValue([]) } as never,
      { check: jest.fn().mockReturnValue([]) } as never,
      { check: jest.fn().mockReturnValue([]) } as never,
      { getAccessibleSchoolIds: jest.fn().mockResolvedValue([]) } as never,
    );
  });

  // --- Generators ---

  /** Pool of period IDs (5-10 UUIDs) */
  const periodPoolArb = fc.uniqueArray(fc.uuid(), {
    minLength: 5,
    maxLength: 10,
  });

  /** Pool of teacher IDs */
  const teacherPoolArb = fc.uniqueArray(fc.uuid(), {
    minLength: 3,
    maxLength: 8,
  });

  /** Pool of class IDs */
  const classPoolArb = fc.uniqueArray(fc.uuid(), {
    minLength: 3,
    maxLength: 8,
  });

  /** Pool of room IDs */
  const roomPoolArb = fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 6 });

  /** Generate a random timetable slot given entity pools */
  function slotArb(
    periodPool: string[],
    teacherPool: string[],
    classPool: string[],
    roomPool: string[],
  ) {
    return fc.record({
      id: fc.uuid(),
      dayOfWeek: fc.integer({ min: 2, max: 7 }),
      periodId: fc.constantFrom(...periodPool),
      teacherId: fc.constantFrom(...teacherPool),
      classId: fc.constantFrom(...classPool),
      roomId: fc.oneof(fc.constantFrom(...roomPool), fc.constant(null)),
    });
  }

  /**
   * Generate an array of slots that includes some deliberate overlaps.
   * We generate base slots randomly, then inject some duplicate (dayOfWeek, periodId)
   * slots with shared entity IDs to guarantee conflicts exist.
   */
  const slotsWithOverlapsArb = fc
    .record({
      periodPool: periodPoolArb,
      teacherPool: teacherPoolArb,
      classPool: classPoolArb,
      roomPool: roomPoolArb,
    })
    .chain(({ periodPool, teacherPool, classPool, roomPool }) =>
      fc
        .record({
          baseSlots: fc.array(
            slotArb(periodPool, teacherPool, classPool, roomPool),
            { minLength: 5, maxLength: 30 },
          ),
          // Additional duplicate slots that deliberately share (dayOfWeek, periodId) + entity
          overlapCount: fc.integer({ min: 1, max: 10 }),
          overlapDayOfWeek: fc.integer({ min: 2, max: 7 }),
          overlapPeriodId: fc.constantFrom(...periodPool),
          overlapTeacherId: fc.constantFrom(...teacherPool),
          overlapClassId: fc.constantFrom(...classPool),
          overlapRoomId: fc.constantFrom(...roomPool),
        })
        .map(
          ({
            baseSlots,
            overlapCount,
            overlapDayOfWeek,
            overlapPeriodId,
            overlapTeacherId,
            overlapClassId,
            overlapRoomId,
          }) => {
            // Build overlap slots — all share same (dayOfWeek, periodId) and at least one entity
            const overlapSlots: Array<{
              id: string;
              dayOfWeek: number;
              periodId: string;
              teacherId: string;
              classId: string;
              roomId: string | null;
            }> = [];
            for (let i = 0; i < overlapCount; i++) {
              overlapSlots.push({
                id: `overlap-${i}-${Math.random().toString(36).slice(2, 10)}`,
                dayOfWeek: overlapDayOfWeek,
                periodId: overlapPeriodId,
                teacherId: overlapTeacherId,
                classId: overlapClassId,
                roomId: overlapRoomId,
              });
            }
            return [...baseSlots, ...overlapSlots];
          },
        ),
    );

  /**
   * Compute expected conflicts independently using a naive O(n²) approach.
   * This is the "oracle" implementation used to verify no false negatives.
   */
  function computeExpectedConflicts(
    slots: Array<{
      id: string;
      dayOfWeek: number;
      periodId: string;
      teacherId: string;
      classId: string;
      roomId: string | null;
    }>,
  ): {
    teacherConflicts: Map<string, string[]>;
    classConflicts: Map<string, string[]>;
    roomConflicts: Map<string, string[]>;
  } {
    // Group by (dayOfWeek, periodId, entityId) → slot IDs
    const teacherConflicts = new Map<string, string[]>();
    const classConflicts = new Map<string, string[]>();
    const roomConflicts = new Map<string, string[]>();

    for (const slot of slots) {
      const teacherKey = `${slot.teacherId}_${slot.dayOfWeek}_${slot.periodId}`;
      if (!teacherConflicts.has(teacherKey)) {
        teacherConflicts.set(teacherKey, []);
      }
      teacherConflicts.get(teacherKey)!.push(slot.id);

      const classKey = `${slot.classId}_${slot.dayOfWeek}_${slot.periodId}`;
      if (!classConflicts.has(classKey)) {
        classConflicts.set(classKey, []);
      }
      classConflicts.get(classKey)!.push(slot.id);

      if (slot.roomId) {
        const roomKey = `${slot.roomId}_${slot.dayOfWeek}_${slot.periodId}`;
        if (!roomConflicts.has(roomKey)) {
          roomConflicts.set(roomKey, []);
        }
        roomConflicts.get(roomKey)!.push(slot.id);
      }
    }

    return { teacherConflicts, classConflicts, roomConflicts };
  }

  // --- Properties ---

  it('should report a conflict for every teacher double-booking (no false negatives)', async () => {
    await fc.assert(
      fc.asyncProperty(slotsWithOverlapsArb, async (slots) => {
        // Arrange: Mock repository to return generated slots as TimetableSlotEntity-like objects
        const slotEntities = slots.map((s) => ({
          ...s,
          schoolId: 'school-1',
          versionId: 'version-1',
          subjectId: 'subject-1',
          isDoublePeriod: false,
        })) as unknown as TimetableSlotEntity[];

        mockSlotRepository.findByVersion.mockResolvedValue(slotEntities);

        // Act
        const result: PostGenerationConflictResult[] =
          await service.detectPostGenerationConflicts('version-1', 'school-1');

        // Assert: Compute expected teacher conflicts independently
        const { teacherConflicts } = computeExpectedConflicts(slots);

        const expectedTeacherConflictKeys = new Set<string>();
        for (const [key, slotIds] of teacherConflicts) {
          if (slotIds.length > 1) {
            expectedTeacherConflictKeys.add(key);
          }
        }

        const reportedTeacherConflicts = result.filter(
          (c) => c.type === 'teacher_double_booking',
        );

        // Every expected conflict must be reported
        for (const key of expectedTeacherConflictKeys) {
          const [teacherId, dayStr, periodId] = key.split('_');
          const matchingConflict = reportedTeacherConflicts.find(
            (c) =>
              c.entityId === teacherId &&
              c.dayOfWeek === Number(dayStr) &&
              c.periodId === periodId,
          );
          expect(matchingConflict).toBeDefined();
          // Verify all slot IDs in this group are reported
          const expectedSlotIds = teacherConflicts.get(key)!;
          expect(matchingConflict!.slotIds.sort()).toEqual(
            expectedSlotIds.sort(),
          );
        }

        // No extra teacher conflicts reported (no false positives)
        expect(reportedTeacherConflicts.length).toBe(
          expectedTeacherConflictKeys.size,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('should report a conflict for every class double-booking (no false negatives)', async () => {
    await fc.assert(
      fc.asyncProperty(slotsWithOverlapsArb, async (slots) => {
        const slotEntities = slots.map((s) => ({
          ...s,
          schoolId: 'school-1',
          versionId: 'version-1',
          subjectId: 'subject-1',
          isDoublePeriod: false,
        })) as unknown as TimetableSlotEntity[];

        mockSlotRepository.findByVersion.mockResolvedValue(slotEntities);

        const result: PostGenerationConflictResult[] =
          await service.detectPostGenerationConflicts('version-1', 'school-1');

        // Compute expected class conflicts independently
        const { classConflicts } = computeExpectedConflicts(slots);

        const expectedClassConflictKeys = new Set<string>();
        for (const [key, slotIds] of classConflicts) {
          if (slotIds.length > 1) {
            expectedClassConflictKeys.add(key);
          }
        }

        const reportedClassConflicts = result.filter(
          (c) => c.type === 'class_double_booking',
        );

        // Every expected class conflict must be reported
        for (const key of expectedClassConflictKeys) {
          const [classId, dayStr, periodId] = key.split('_');
          const matchingConflict = reportedClassConflicts.find(
            (c) =>
              c.entityId === classId &&
              c.dayOfWeek === Number(dayStr) &&
              c.periodId === periodId,
          );
          expect(matchingConflict).toBeDefined();
          const expectedSlotIds = classConflicts.get(key)!;
          expect(matchingConflict!.slotIds.sort()).toEqual(
            expectedSlotIds.sort(),
          );
        }

        // No extra class conflicts reported
        expect(reportedClassConflicts.length).toBe(
          expectedClassConflictKeys.size,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('should report a conflict for every room double-booking where roomId is not null (no false negatives)', async () => {
    await fc.assert(
      fc.asyncProperty(slotsWithOverlapsArb, async (slots) => {
        const slotEntities = slots.map((s) => ({
          ...s,
          schoolId: 'school-1',
          versionId: 'version-1',
          subjectId: 'subject-1',
          isDoublePeriod: false,
        })) as unknown as TimetableSlotEntity[];

        mockSlotRepository.findByVersion.mockResolvedValue(slotEntities);

        const result: PostGenerationConflictResult[] =
          await service.detectPostGenerationConflicts('version-1', 'school-1');

        // Compute expected room conflicts independently
        const { roomConflicts } = computeExpectedConflicts(slots);

        const expectedRoomConflictKeys = new Set<string>();
        for (const [key, slotIds] of roomConflicts) {
          if (slotIds.length > 1) {
            expectedRoomConflictKeys.add(key);
          }
        }

        const reportedRoomConflicts = result.filter(
          (c) => c.type === 'room_double_booking',
        );

        // Every expected room conflict must be reported
        for (const key of expectedRoomConflictKeys) {
          const [roomId, dayStr, periodId] = key.split('_');
          const matchingConflict = reportedRoomConflicts.find(
            (c) =>
              c.entityId === roomId &&
              c.dayOfWeek === Number(dayStr) &&
              c.periodId === periodId,
          );
          expect(matchingConflict).toBeDefined();
          const expectedSlotIds = roomConflicts.get(key)!;
          expect(matchingConflict!.slotIds.sort()).toEqual(
            expectedSlotIds.sort(),
          );
        }

        // No extra room conflicts reported
        expect(reportedRoomConflicts.length).toBe(
          expectedRoomConflictKeys.size,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('should not report room conflicts when roomId is null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            dayOfWeek: fc.integer({ min: 2, max: 7 }),
            periodId: fc.uuid(),
            teacherId: fc.uuid(),
            classId: fc.uuid(),
          }),
          { minLength: 2, maxLength: 20 },
        ),
        async (baseSlots) => {
          // All slots have roomId = null
          const slots = baseSlots.map((s) => ({
            ...s,
            roomId: null,
            schoolId: 'school-1',
            versionId: 'version-1',
            subjectId: 'subject-1',
            isDoublePeriod: false,
          })) as unknown as TimetableSlotEntity[];

          mockSlotRepository.findByVersion.mockResolvedValue(slots);

          const result: PostGenerationConflictResult[] =
            await service.detectPostGenerationConflicts(
              'version-1',
              'school-1',
            );

          const roomConflicts = result.filter(
            (c) => c.type === 'room_double_booking',
          );
          expect(roomConflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should report ALL conflict types comprehensively — total conflicts equals sum of teacher + class + room conflicts', async () => {
    await fc.assert(
      fc.asyncProperty(slotsWithOverlapsArb, async (slots) => {
        const slotEntities = slots.map((s) => ({
          ...s,
          schoolId: 'school-1',
          versionId: 'version-1',
          subjectId: 'subject-1',
          isDoublePeriod: false,
        })) as unknown as TimetableSlotEntity[];

        mockSlotRepository.findByVersion.mockResolvedValue(slotEntities);

        const result: PostGenerationConflictResult[] =
          await service.detectPostGenerationConflicts('version-1', 'school-1');

        // Independently compute all expected conflicts
        const { teacherConflicts, classConflicts, roomConflicts } =
          computeExpectedConflicts(slots);

        let expectedTotal = 0;
        for (const [, slotIds] of teacherConflicts) {
          if (slotIds.length > 1) expectedTotal++;
        }
        for (const [, slotIds] of classConflicts) {
          if (slotIds.length > 1) expectedTotal++;
        }
        for (const [, slotIds] of roomConflicts) {
          if (slotIds.length > 1) expectedTotal++;
        }

        // Total reported conflicts must match total expected
        expect(result.length).toBe(expectedTotal);
      }),
      { numRuns: 100 },
    );
  });
});
