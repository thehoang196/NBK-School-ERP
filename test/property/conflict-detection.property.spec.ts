import * as fc from 'fast-check';
import {
  ConflictDetectionService,
  ConflictType,
  CrossSchoolBusySlot,
} from '../../src/modules/timetable/services/conflict-detection.service';

/**
 * Property-Based Tests for Cross-School Conflict Detection
 *
 * Property 9: Cross-School Conflict Detection
 * For any teacher, for any two TimetableSlots in different schools with the
 * same dayOfWeek, same periodId, and same semester, the ConflictDetectionService
 * SHALL detect a CROSS_SCHOOL_CONFLICT and return a record containing teacherId,
 * dayOfWeek, periodId, and both school identifiers.
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 3.2, 3.3**
 */

// --- Custom Arbitraries ---

/** Generate a random UUID v4 */
const uuidArb = fc.uuid({ version: 4 });

/** Generate a valid day of week (1-7, Monday to Sunday) */
const dayOfWeekArb = fc.integer({ min: 1, max: 7 });

/** Generate a random period ID (UUID) */
const periodIdArb = fc.uuid({ version: 4 });

/** Generate a random school ID (UUID) */
const schoolIdArb = fc.uuid({ version: 4 });

/** Generate a random teacher ID (UUID) */
const teacherIdArb = fc.uuid({ version: 4 });

/** Generate a random semester ID (UUID) */
const semesterIdArb = fc.uuid({ version: 4 });

/**
 * Generate a timetable slot definition for a specific teacher and school.
 */
const arbTimetableSlot = (
  schoolId: fc.Arbitrary<string>,
  teacherId: fc.Arbitrary<string>,
) =>
  fc.record({
    teacherId,
    schoolId,
    dayOfWeek: dayOfWeekArb,
    periodId: periodIdArb,
  });

/**
 * Generate multiple busy slots from other schools for cross-school scenario.
 */
const arbBusySlots = (schoolIds: fc.Arbitrary<string[]>) =>
  fc
    .tuple(schoolIds, dayOfWeekArb, periodIdArb)
    .chain(([schools, day, period]) =>
      fc.constant(
        schools.map((schoolId) => ({
          dayOfWeek: day,
          periodId: period,
          schoolId,
        })),
      ),
    );

// --- Helper to create a partially-mocked ConflictDetectionService ---

/**
 * Creates a ConflictDetectionService instance with only the cross-school conflict
 * detection logic active. All DB-dependent methods are mocked to return controlled data.
 */
function createServiceWithBusySlots(
  busySlots: CrossSchoolBusySlot[],
): ConflictDetectionService {
  // Create a service instance with mocked dependencies
  const service = Object.create(
    ConflictDetectionService.prototype,
  ) as ConflictDetectionService;

  // Override the getCrossSchoolBusySlots method to return controlled data
  (service as any).getCrossSchoolBusySlots = async (
    _teacherId: string,
    excludeSchoolId: string,
    _semesterId: string,
  ): Promise<CrossSchoolBusySlot[]> => {
    return busySlots.filter((slot) => slot.schoolId !== excludeSchoolId);
  };

  return service;
}

describe('Feature: cross-campus-teaching | Property 9: Cross-School Conflict Detection', () => {
  /**
   * Property 9a: Same teacher, same dayOfWeek, same periodId, different schools
   * → CROSS_SCHOOL_CONFLICT SHALL be detected.
   *
   * For any teacher assigned to school A and school B (A ≠ B), when there is
   * an existing TimetableSlot at school B for the same (dayOfWeek, periodId, semester),
   * checkCrossSchoolConflicts called from school A SHALL detect the conflict.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 9a: Conflicting slots in different schools are always detected', () => {
    it('same teacher, same day, same period, different school → conflict detected', async () => {
      await fc.assert(
        fc.asyncProperty(
          teacherIdArb,
          schoolIdArb,
          schoolIdArb,
          dayOfWeekArb,
          periodIdArb,
          semesterIdArb,
          async (
            teacherId,
            schoolA,
            schoolB,
            dayOfWeek,
            periodId,
            semesterId,
          ) => {
            // Precondition: schools must be different
            fc.pre(schoolA !== schoolB);

            // School B has a busy slot at (dayOfWeek, periodId)
            const busySlots: CrossSchoolBusySlot[] = [
              { dayOfWeek, periodId, schoolId: schoolB },
            ];

            // Create service with busy slots from school B
            const service = createServiceWithBusySlots(busySlots);

            // Check conflicts from school A's perspective
            const conflicts = await service.checkCrossSchoolConflicts(
              teacherId,
              dayOfWeek,
              periodId,
              schoolA,
              semesterId,
            );

            // MUST detect at least one cross-school conflict
            expect(conflicts.length).toBeGreaterThanOrEqual(1);
            expect(conflicts[0].type).toBe(ConflictType.CROSS_SCHOOL_CONFLICT);
            expect(conflicts[0].details.teacherId).toBe(teacherId);
            expect(conflicts[0].details.dayOfWeek).toBe(dayOfWeek);
            expect(conflicts[0].details.periodId).toBe(periodId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 9b: No conflict when dayOfWeek differs.
   *
   * For any teacher at school A with a busy slot at school B on a different dayOfWeek,
   * checkCrossSchoolConflicts SHALL NOT detect a conflict.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 9b: Different dayOfWeek → no conflict', () => {
    it('same teacher, different day, same period, different school → no conflict', async () => {
      await fc.assert(
        fc.asyncProperty(
          teacherIdArb,
          schoolIdArb,
          schoolIdArb,
          dayOfWeekArb,
          dayOfWeekArb,
          periodIdArb,
          semesterIdArb,
          async (
            teacherId,
            schoolA,
            schoolB,
            dayA,
            dayB,
            periodId,
            semesterId,
          ) => {
            // Precondition: schools must be different AND days must be different
            fc.pre(schoolA !== schoolB);
            fc.pre(dayA !== dayB);

            // School B has a busy slot at (dayB, periodId)
            const busySlots: CrossSchoolBusySlot[] = [
              { dayOfWeek: dayB, periodId, schoolId: schoolB },
            ];

            const service = createServiceWithBusySlots(busySlots);

            // Check conflicts for dayA (different from dayB)
            const conflicts = await service.checkCrossSchoolConflicts(
              teacherId,
              dayA,
              periodId,
              schoolA,
              semesterId,
            );

            // No conflict should be detected
            expect(conflicts.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 9c: No conflict when periodId differs.
   *
   * For any teacher at school A with a busy slot at school B with a different periodId,
   * checkCrossSchoolConflicts SHALL NOT detect a conflict.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 9c: Different periodId → no conflict', () => {
    it('same teacher, same day, different period, different school → no conflict', async () => {
      await fc.assert(
        fc.asyncProperty(
          teacherIdArb,
          schoolIdArb,
          schoolIdArb,
          dayOfWeekArb,
          periodIdArb,
          periodIdArb,
          semesterIdArb,
          async (
            teacherId,
            schoolA,
            schoolB,
            dayOfWeek,
            periodA,
            periodB,
            semesterId,
          ) => {
            // Precondition: schools must be different AND periods must be different
            fc.pre(schoolA !== schoolB);
            fc.pre(periodA !== periodB);

            // School B has a busy slot at (dayOfWeek, periodB)
            const busySlots: CrossSchoolBusySlot[] = [
              { dayOfWeek, periodId: periodB, schoolId: schoolB },
            ];

            const service = createServiceWithBusySlots(busySlots);

            // Check conflicts for periodA (different from periodB)
            const conflicts = await service.checkCrossSchoolConflicts(
              teacherId,
              dayOfWeek,
              periodA,
              schoolA,
              semesterId,
            );

            // No conflict should be detected
            expect(conflicts.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 9d: No conflict when the busy slot is at the same school (not cross-school).
   *
   * Busy slots from the SAME school are filtered out — cross-school conflict detection
   * only considers slots from OTHER schools.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 9d: Same school busy slot → no cross-school conflict', () => {
    it('busy slot at the same school is excluded from cross-school conflict', async () => {
      await fc.assert(
        fc.asyncProperty(
          teacherIdArb,
          schoolIdArb,
          dayOfWeekArb,
          periodIdArb,
          semesterIdArb,
          async (teacherId, schoolA, dayOfWeek, periodId, semesterId) => {
            // Busy slot is at the SAME school (schoolA)
            const busySlots: CrossSchoolBusySlot[] = [
              { dayOfWeek, periodId, schoolId: schoolA },
            ];

            const service = createServiceWithBusySlots(busySlots);

            // Check conflicts from school A's perspective
            const conflicts = await service.checkCrossSchoolConflicts(
              teacherId,
              dayOfWeek,
              periodId,
              schoolA,
              semesterId,
            );

            // No cross-school conflict — it's the same school
            expect(conflicts.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 9e: Multiple conflicting slots from different schools are all detected.
   *
   * For any teacher with busy slots at N different schools (all at the same dayOfWeek + periodId),
   * checkCrossSchoolConflicts SHALL detect one conflict per other school.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 9e: Multiple cross-school conflicts are all detected', () => {
    it('busy slots at multiple other schools all produce conflicts', async () => {
      await fc.assert(
        fc.asyncProperty(
          teacherIdArb,
          fc.array(schoolIdArb, { minLength: 2, maxLength: 5 }),
          dayOfWeekArb,
          periodIdArb,
          semesterIdArb,
          async (teacherId, schoolIds, dayOfWeek, periodId, semesterId) => {
            // Ensure all school IDs are unique
            const uniqueSchools = [...new Set(schoolIds)];
            fc.pre(uniqueSchools.length >= 2);

            const currentSchool = uniqueSchools[0];
            const otherSchools = uniqueSchools.slice(1);

            // All other schools have a busy slot at (dayOfWeek, periodId)
            const busySlots: CrossSchoolBusySlot[] = otherSchools.map(
              (schoolId) => ({
                dayOfWeek,
                periodId,
                schoolId,
              }),
            );

            const service = createServiceWithBusySlots(busySlots);

            // Check conflicts from current school's perspective
            const conflicts = await service.checkCrossSchoolConflicts(
              teacherId,
              dayOfWeek,
              periodId,
              currentSchool,
              semesterId,
            );

            // Should detect one conflict per other school
            expect(conflicts.length).toBe(otherSchools.length);

            // All conflicts must be CROSS_SCHOOL_CONFLICT
            for (const conflict of conflicts) {
              expect(conflict.type).toBe(ConflictType.CROSS_SCHOOL_CONFLICT);
              expect(conflict.severity).toBe('error');
              expect(conflict.details.teacherId).toBe(teacherId);
              expect(conflict.details.dayOfWeek).toBe(dayOfWeek);
              expect(conflict.details.periodId).toBe(periodId);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 9f: No busy slots → no conflict.
   *
   * For any teacher with an empty busy slot list (no slots at other schools),
   * checkCrossSchoolConflicts SHALL return an empty array.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 9f: No busy slots from other schools → no conflict', () => {
    it('empty busy slots always produces no conflicts', async () => {
      await fc.assert(
        fc.asyncProperty(
          teacherIdArb,
          schoolIdArb,
          dayOfWeekArb,
          periodIdArb,
          semesterIdArb,
          async (teacherId, schoolA, dayOfWeek, periodId, semesterId) => {
            // No busy slots at all
            const busySlots: CrossSchoolBusySlot[] = [];

            const service = createServiceWithBusySlots(busySlots);

            const conflicts = await service.checkCrossSchoolConflicts(
              teacherId,
              dayOfWeek,
              periodId,
              schoolA,
              semesterId,
            );

            expect(conflicts.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
