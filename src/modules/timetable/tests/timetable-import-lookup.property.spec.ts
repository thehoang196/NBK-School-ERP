/**
 * Property-Based Test: Import lookup respects school_id scoping
 *
 * Feature: timetable-management-features, Property 2: Import lookup respects school_id scoping
 * Validates: Requirements 1.3, 5.3
 *
 * For any entity code (teacher, subject, class, period) and school context,
 * the lookup SHALL return the entity only if it belongs to the same school_id,
 * and SHALL return null for codes belonging to other schools.
 */
import * as fc from 'fast-check';
import { IsNull } from 'typeorm';
import { TimetableImportService } from '../services/timetable-import.service';
import { ParsedTimetableRow, ValidatedSlotData, TimetableImportError } from '../interfaces/timetable-import.interface';

describe('Feature: timetable-management-features, Property 2: Import lookup respects school_id scoping', () => {
  // Arbitrary: non-empty alphanumeric strings for codes/names
  const alphanumChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const nonEmptyAlphanumString: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...alphanumChars.split('')), { minLength: 1, maxLength: 15 })
    .map((chars) => chars.join(''));

  const uuidArb: fc.Arbitrary<string> = fc.uuid();
  const dayOfWeekArb = fc.integer({ min: 2, max: 7 });
  const periodNumberArb = fc.integer({ min: 1, max: 15 });

  /**
   * Helper: creates a mock repository that returns entities only matching a specific schoolId.
   * Simulates TypeORM Repository.find() behavior with school_id scoping.
   */
  function createMockRepo<T>(entities: T[]): { find: jest.Mock } {
    return {
      find: jest.fn().mockImplementation(({ where }: { where: { schoolId: string; deletedAt: unknown } }) => {
        const filtered = entities.filter((e: any) => e.schoolId === where.schoolId && e.deletedAt === null);
        return Promise.resolve(filtered);
      }),
    };
  }

  /**
   * Interface for generated test scenario entities
   */
  interface TestScenario {
    targetSchoolId: string;
    otherSchoolId: string;
    teacherCode: string;
    subjectCode: string;
    className: string;
    periodNumber: number;
    roomCode: string;
    dayOfWeek: number;
  }

  const testScenarioArb: fc.Arbitrary<TestScenario> = fc.record({
    targetSchoolId: uuidArb,
    otherSchoolId: uuidArb,
    teacherCode: nonEmptyAlphanumString,
    subjectCode: nonEmptyAlphanumString,
    className: nonEmptyAlphanumString,
    periodNumber: periodNumberArb,
    roomCode: nonEmptyAlphanumString,
    dayOfWeek: dayOfWeekArb,
  }).filter((s) => s.targetSchoolId !== s.otherSchoolId);

  it('should return ValidatedSlotData when all entities belong to the SAME school', async () => {
    await fc.assert(
      fc.asyncProperty(testScenarioArb, async (scenario) => {
        const { targetSchoolId, teacherCode, subjectCode, className, periodNumber, roomCode, dayOfWeek } = scenario;

        // Create entities belonging to the target school
        const teacherId = `teacher-${targetSchoolId.slice(0, 8)}`;
        const subjectId = `subject-${targetSchoolId.slice(0, 8)}`;
        const classId = `class-${targetSchoolId.slice(0, 8)}`;
        const periodId = `period-${targetSchoolId.slice(0, 8)}`;
        const roomId = `room-${targetSchoolId.slice(0, 8)}`;

        const teachers = [{ id: teacherId, schoolId: targetSchoolId, employeeCode: teacherCode, deletedAt: null }];
        const subjects = [{ id: subjectId, schoolId: targetSchoolId, code: subjectCode, deletedAt: null }];
        const classes = [{ id: classId, schoolId: targetSchoolId, name: className, deletedAt: null }];
        const periods = [{ id: periodId, schoolId: targetSchoolId, periodNumber, deletedAt: null }];
        const rooms = [{ id: roomId, schoolId: targetSchoolId, code: roomCode, deletedAt: null }];

        const mockTeacherRepo = createMockRepo(teachers);
        const mockSubjectRepo = createMockRepo(subjects);
        const mockClassRepo = createMockRepo(classes);
        const mockPeriodRepo = createMockRepo(periods);
        const mockRoomRepo = createMockRepo(rooms);

        const service = new TimetableImportService(
          null as any, // dataSource
          null as any, // versionRepo
          mockTeacherRepo as any,
          mockSubjectRepo as any,
          mockClassRepo as any,
          mockPeriodRepo as any,
          mockRoomRepo as any,
        );

        const rows: ParsedTimetableRow[] = [{
          className,
          dayOfWeek,
          periodNumber,
          subjectCode,
          teacherCode,
          roomCode,
        }];

        const result = await service.lookupEntities(rows, targetSchoolId);

        // Should produce 1 valid slot and 0 errors
        expect(result.validSlots).toHaveLength(1);
        expect(result.errors).toHaveLength(0);

        // Verify the slot contains correct entity IDs
        const slot = result.validSlots[0];
        expect(slot.classId).toBe(classId);
        expect(slot.subjectId).toBe(subjectId);
        expect(slot.teacherId).toBe(teacherId);
        expect(slot.periodId).toBe(periodId);
        expect(slot.roomId).toBe(roomId);
        expect(slot.dayOfWeek).toBe(dayOfWeek);
      }),
      { numRuns: 100 },
    );
  });

  it('should return errors when entities belong to a DIFFERENT school', async () => {
    await fc.assert(
      fc.asyncProperty(testScenarioArb, async (scenario) => {
        const { targetSchoolId, otherSchoolId, teacherCode, subjectCode, className, periodNumber, roomCode, dayOfWeek } = scenario;

        // Create entities belonging to the OTHER school (not the target school)
        const teachers = [{ id: 'teacher-other', schoolId: otherSchoolId, employeeCode: teacherCode, deletedAt: null }];
        const subjects = [{ id: 'subject-other', schoolId: otherSchoolId, code: subjectCode, deletedAt: null }];
        const classes = [{ id: 'class-other', schoolId: otherSchoolId, name: className, deletedAt: null }];
        const periods = [{ id: 'period-other', schoolId: otherSchoolId, periodNumber, deletedAt: null }];
        const rooms = [{ id: 'room-other', schoolId: otherSchoolId, code: roomCode, deletedAt: null }];

        const mockTeacherRepo = createMockRepo(teachers);
        const mockSubjectRepo = createMockRepo(subjects);
        const mockClassRepo = createMockRepo(classes);
        const mockPeriodRepo = createMockRepo(periods);
        const mockRoomRepo = createMockRepo(rooms);

        const service = new TimetableImportService(
          null as any,
          null as any,
          mockTeacherRepo as any,
          mockSubjectRepo as any,
          mockClassRepo as any,
          mockPeriodRepo as any,
          mockRoomRepo as any,
        );

        const rows: ParsedTimetableRow[] = [{
          className,
          dayOfWeek,
          periodNumber,
          subjectCode,
          teacherCode,
          roomCode,
        }];

        const result = await service.lookupEntities(rows, targetSchoolId);

        // Should produce 0 valid slots (entities are in a different school)
        expect(result.validSlots).toHaveLength(0);

        // Should have errors indicating entities not found
        expect(result.errors.length).toBeGreaterThan(0);

        // Verify that NO slot from the other school leaked through
        for (const slot of result.validSlots) {
          // This should never execute, but if it does, verify no cross-school entity
          expect(slot.teacherId).not.toBe('teacher-other');
          expect(slot.subjectId).not.toBe('subject-other');
          expect(slot.classId).not.toBe('class-other');
          expect(slot.periodId).not.toBe('period-other');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should NEVER return entities from another school regardless of matching codes', async () => {
    // This property tests mixed scenarios: entities exist in both schools with same codes
    const mixedScenarioArb = fc.record({
      targetSchoolId: uuidArb,
      otherSchoolId: uuidArb,
      teacherCode: nonEmptyAlphanumString,
      subjectCode: nonEmptyAlphanumString,
      className: nonEmptyAlphanumString,
      periodNumber: periodNumberArb,
      roomCode: nonEmptyAlphanumString,
      dayOfWeek: dayOfWeekArb,
    }).filter((s) => s.targetSchoolId !== s.otherSchoolId);

    await fc.assert(
      fc.asyncProperty(mixedScenarioArb, async (scenario) => {
        const { targetSchoolId, otherSchoolId, teacherCode, subjectCode, className, periodNumber, roomCode, dayOfWeek } = scenario;

        // Entities exist in BOTH schools with the same codes but different IDs
        const targetTeacherId = `teacher-target-${targetSchoolId.slice(0, 8)}`;
        const otherTeacherId = `teacher-other-${otherSchoolId.slice(0, 8)}`;
        const targetSubjectId = `subject-target-${targetSchoolId.slice(0, 8)}`;
        const otherSubjectId = `subject-other-${otherSchoolId.slice(0, 8)}`;
        const targetClassId = `class-target-${targetSchoolId.slice(0, 8)}`;
        const otherClassId = `class-other-${otherSchoolId.slice(0, 8)}`;
        const targetPeriodId = `period-target-${targetSchoolId.slice(0, 8)}`;
        const otherPeriodId = `period-other-${otherSchoolId.slice(0, 8)}`;
        const targetRoomId = `room-target-${targetSchoolId.slice(0, 8)}`;
        const otherRoomId = `room-other-${otherSchoolId.slice(0, 8)}`;

        // Both schools have entities with the same codes
        const teachers = [
          { id: targetTeacherId, schoolId: targetSchoolId, employeeCode: teacherCode, deletedAt: null },
          { id: otherTeacherId, schoolId: otherSchoolId, employeeCode: teacherCode, deletedAt: null },
        ];
        const subjects = [
          { id: targetSubjectId, schoolId: targetSchoolId, code: subjectCode, deletedAt: null },
          { id: otherSubjectId, schoolId: otherSchoolId, code: subjectCode, deletedAt: null },
        ];
        const classes = [
          { id: targetClassId, schoolId: targetSchoolId, name: className, deletedAt: null },
          { id: otherClassId, schoolId: otherSchoolId, name: className, deletedAt: null },
        ];
        const periods = [
          { id: targetPeriodId, schoolId: targetSchoolId, periodNumber, deletedAt: null },
          { id: otherPeriodId, schoolId: otherSchoolId, periodNumber, deletedAt: null },
        ];
        const rooms = [
          { id: targetRoomId, schoolId: targetSchoolId, code: roomCode, deletedAt: null },
          { id: otherRoomId, schoolId: otherSchoolId, code: roomCode, deletedAt: null },
        ];

        const mockTeacherRepo = createMockRepo(teachers);
        const mockSubjectRepo = createMockRepo(subjects);
        const mockClassRepo = createMockRepo(classes);
        const mockPeriodRepo = createMockRepo(periods);
        const mockRoomRepo = createMockRepo(rooms);

        const service = new TimetableImportService(
          null as any,
          null as any,
          mockTeacherRepo as any,
          mockSubjectRepo as any,
          mockClassRepo as any,
          mockPeriodRepo as any,
          mockRoomRepo as any,
        );

        const rows: ParsedTimetableRow[] = [{
          className,
          dayOfWeek,
          periodNumber,
          subjectCode,
          teacherCode,
          roomCode,
        }];

        const result = await service.lookupEntities(rows, targetSchoolId);

        // Should produce exactly 1 valid slot
        expect(result.validSlots).toHaveLength(1);
        expect(result.errors).toHaveLength(0);

        const slot = result.validSlots[0];

        // CRITICAL: slot MUST contain IDs from the TARGET school, never from another school
        expect(slot.teacherId).toBe(targetTeacherId);
        expect(slot.teacherId).not.toBe(otherTeacherId);

        expect(slot.subjectId).toBe(targetSubjectId);
        expect(slot.subjectId).not.toBe(otherSubjectId);

        expect(slot.classId).toBe(targetClassId);
        expect(slot.classId).not.toBe(otherClassId);

        expect(slot.periodId).toBe(targetPeriodId);
        expect(slot.periodId).not.toBe(otherPeriodId);

        expect(slot.roomId).toBe(targetRoomId);
        expect(slot.roomId).not.toBe(otherRoomId);
      }),
      { numRuns: 100 },
    );
  });

  it('should handle optional roomCode: lookup room only when roomCode is non-empty', async () => {
    const scenarioWithoutRoom = fc.record({
      targetSchoolId: uuidArb,
      teacherCode: nonEmptyAlphanumString,
      subjectCode: nonEmptyAlphanumString,
      className: nonEmptyAlphanumString,
      periodNumber: periodNumberArb,
      dayOfWeek: dayOfWeekArb,
    });

    await fc.assert(
      fc.asyncProperty(scenarioWithoutRoom, async (scenario) => {
        const { targetSchoolId, teacherCode, subjectCode, className, periodNumber, dayOfWeek } = scenario;

        const teacherId = `teacher-${targetSchoolId.slice(0, 8)}`;
        const subjectId = `subject-${targetSchoolId.slice(0, 8)}`;
        const classId = `class-${targetSchoolId.slice(0, 8)}`;
        const periodId = `period-${targetSchoolId.slice(0, 8)}`;

        const teachers = [{ id: teacherId, schoolId: targetSchoolId, employeeCode: teacherCode, deletedAt: null }];
        const subjects = [{ id: subjectId, schoolId: targetSchoolId, code: subjectCode, deletedAt: null }];
        const classes = [{ id: classId, schoolId: targetSchoolId, name: className, deletedAt: null }];
        const periods = [{ id: periodId, schoolId: targetSchoolId, periodNumber, deletedAt: null }];
        const rooms: any[] = []; // No rooms at all

        const mockTeacherRepo = createMockRepo(teachers);
        const mockSubjectRepo = createMockRepo(subjects);
        const mockClassRepo = createMockRepo(classes);
        const mockPeriodRepo = createMockRepo(periods);
        const mockRoomRepo = createMockRepo(rooms);

        const service = new TimetableImportService(
          null as any,
          null as any,
          mockTeacherRepo as any,
          mockSubjectRepo as any,
          mockClassRepo as any,
          mockPeriodRepo as any,
          mockRoomRepo as any,
        );

        // Row with empty roomCode (optional field)
        const rows: ParsedTimetableRow[] = [{
          className,
          dayOfWeek,
          periodNumber,
          subjectCode,
          teacherCode,
          roomCode: '', // empty = no room lookup needed
        }];

        const result = await service.lookupEntities(rows, targetSchoolId);

        // Should succeed without room
        expect(result.validSlots).toHaveLength(1);
        expect(result.errors).toHaveLength(0);

        const slot = result.validSlots[0];
        expect(slot.roomId).toBeUndefined();
        expect(slot.teacherId).toBe(teacherId);
        expect(slot.subjectId).toBe(subjectId);
        expect(slot.classId).toBe(classId);
        expect(slot.periodId).toBe(periodId);
      }),
      { numRuns: 100 },
    );
  });
});
