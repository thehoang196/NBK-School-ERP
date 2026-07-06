/**
 * Feature: fet-generation-pipeline, Property 9: Deterministic XML Serialization
 *
 * **Validates: Requirements 12.1**
 *
 * Property: For any valid FetInputData, invoking the FET_Input_Exporter's export function
 * twice with identical input SHALL produce byte-identical XML output.
 */
import * as fc from 'fast-check';
import { FetInputExporterService } from '../fet-input-exporter.service';
import {
  FetInputData,
  TeacherDto,
  ClassDto,
  SubjectDto,
  RoomDto,
  TeachingAssignmentDto,
  PeriodDefinitionDto,
  TeacherAvailabilityDto,
  RoomConstraintDto,
} from '../../interfaces/fet-dto.interface';

// ─── Generators ─────────────────────────────────────────────────────────────

/**
 * Generator for TeacherDto[] with unique names and valid maxPeriodsPerDay.
 */
function teachersArb(count: number): fc.Arbitrary<TeacherDto[]> {
  return fc.tuple(
    ...Array.from({ length: count }, (_, i) =>
      fc
        .tuple(fc.constant(`Teacher_${i}`), fc.integer({ min: 1, max: 10 }))
        .map(([name, maxPeriods]) => ({
          id: `t-${i}`,
          name: `${name}_${String.fromCharCode(65 + (i % 26))}`,
          maxPeriodsPerDay: maxPeriods,
        })),
    ),
  );
}

/**
 * Generator for SubjectDto[] with unique names.
 */
function subjectsArb(count: number): fc.Arbitrary<SubjectDto[]> {
  return fc.constant(
    Array.from({ length: count }, (_, i) => ({
      id: `s-${i}`,
      name: `Subject_${i}_${String.fromCharCode(65 + (i % 26))}`,
    })),
  );
}

/**
 * Generator for ClassDto[] with unique names and valid gradeIds.
 */
function classesArb(count: number): fc.Arbitrary<ClassDto[]> {
  return fc.tuple(
    ...Array.from({ length: count }, (_, i) =>
      fc.integer({ min: 1, max: 5 }).map((gradeNum) => ({
        id: `c-${i}`,
        name: `Class_${i}_${String.fromCharCode(65 + (i % 26))}`,
        gradeId: `Grade_${gradeNum}`,
      })),
    ),
  );
}

/**
 * Generator for RoomDto[] with unique names and capacity 20-50.
 */
function roomsArb(count: number): fc.Arbitrary<RoomDto[]> {
  if (count === 0) return fc.constant([]);
  return fc.tuple(
    ...Array.from({ length: count }, (_, i) =>
      fc.integer({ min: 20, max: 50 }).map((capacity) => ({
        id: `r-${i}`,
        name: `Room_${i}_${String.fromCharCode(65 + (i % 26))}`,
        capacity,
      })),
    ),
  );
}

/**
 * Generator for day names (unique).
 */
function daysArb(count: number): fc.Arbitrary<string[]> {
  return fc.constant(Array.from({ length: count }, (_, i) => `Day_${i + 1}`));
}

/**
 * Generator for PeriodDefinitionDto[] with unique names.
 */
function periodDefinitionsArb(
  count: number,
): fc.Arbitrary<PeriodDefinitionDto[]> {
  return fc.constant(
    Array.from({ length: count }, (_, i) => ({
      id: `pd-${i}`,
      periodNumber: i + 1,
      name: `Period_${i + 1}`,
      sessionId: `session-${Math.floor(i / 5)}`,
    })),
  );
}

/**
 * Generator for TeachingAssignmentDto[] referencing valid teachers/classes/subjects.
 */
function assignmentsArb(
  count: number,
  teacherCount: number,
  classCount: number,
  subjectCount: number,
): fc.Arbitrary<TeachingAssignmentDto[]> {
  return fc
    .tuple(
      ...Array.from({ length: count }, (_, i) =>
        fc
          .tuple(
            fc.integer({ min: 0, max: teacherCount - 1 }),
            fc.integer({ min: 0, max: classCount - 1 }),
            fc.integer({ min: 0, max: subjectCount - 1 }),
            fc.integer({ min: 1, max: 6 }),
          )
          .map(([tIdx, cIdx, sIdx, periodsPerWeek]) => ({
            id: `a-${i}`,
            teacherId: `t-${tIdx}`,
            classId: `c-${cIdx}`,
            subjectId: `s-${sIdx}`,
            periodsPerWeek,
          })),
      ),
    )
    .map((assignments) => {
      // Deduplicate by (teacherId, classId, subjectId)
      const seen = new Set<string>();
      return assignments.filter((a) => {
        const key = `${a.teacherId}|${a.classId}|${a.subjectId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
}

/**
 * Generator for TeacherAvailabilityDto[] referencing valid teachers/days/periods.
 */
function teacherAvailabilityArb(
  count: number,
  teacherCount: number,
  dayCount: number,
  periodCount: number,
): fc.Arbitrary<TeacherAvailabilityDto[]> {
  if (count === 0) return fc.constant([]);
  return fc
    .tuple(
      ...Array.from({ length: count }, (_, i) =>
        fc
          .tuple(
            fc.integer({ min: 0, max: teacherCount - 1 }),
            fc.integer({ min: 1, max: 3 }),
          )
          .chain(([tIdx, slotCount]) =>
            fc.tuple(
              fc.constant(tIdx),
              fc.tuple(
                ...Array.from({ length: slotCount }, () =>
                  fc
                    .tuple(
                      fc.integer({ min: 0, max: dayCount - 1 }),
                      fc.integer({ min: 0, max: periodCount - 1 }),
                    )
                    .map(([dayOfWeek, periodIdx]) => ({
                      dayOfWeek,
                      periodId: `pd-${periodIdx}`,
                    })),
                ),
              ),
            ),
          )
          .map(([tIdx, slots]) => ({
            teacherId: `t-${tIdx}`,
            unavailableSlots: slots,
          })),
      ),
    )
    .map((availabilities) => {
      // Deduplicate by teacherId (one availability per teacher)
      const seen = new Set<string>();
      return availabilities.filter((a) => {
        if (seen.has(a.teacherId)) return false;
        seen.add(a.teacherId);
        return true;
      });
    });
}

/**
 * Generator for RoomConstraintDto[] referencing valid subjects/rooms.
 */
function roomConstraintsArb(
  count: number,
  subjectCount: number,
  roomCount: number,
): fc.Arbitrary<RoomConstraintDto[]> {
  if (count === 0 || roomCount === 0) return fc.constant([]);
  return fc
    .tuple(
      ...Array.from({ length: count }, () =>
        fc
          .tuple(
            fc.integer({ min: 0, max: subjectCount - 1 }),
            fc.integer({ min: 0, max: roomCount - 1 }),
            fc.integer({ min: 1, max: 100 }),
          )
          .map(([sIdx, rIdx, weight]) => ({
            subjectId: `s-${sIdx}`,
            roomId: `r-${rIdx}`,
            weight,
          })),
      ),
    )
    .map((constraints) => {
      // Deduplicate by (subjectId, roomId)
      const seen = new Set<string>();
      return constraints.filter((c) => {
        const key = `${c.subjectId}|${c.roomId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
}

/**
 * Master generator: produces a valid FetInputData with proper referential integrity.
 */
const fetInputDataArb: fc.Arbitrary<FetInputData> = fc
  .record({
    teacherCount: fc.integer({ min: 1, max: 10 }),
    subjectCount: fc.integer({ min: 1, max: 5 }),
    classCount: fc.integer({ min: 1, max: 10 }),
    roomCount: fc.integer({ min: 0, max: 5 }),
    dayCount: fc.integer({ min: 1, max: 5 }),
    periodCount: fc.integer({ min: 1, max: 10 }),
    assignmentCount: fc.integer({ min: 1, max: 15 }),
    availabilityCount: fc.integer({ min: 0, max: 5 }),
    roomConstraintCount: fc.integer({ min: 0, max: 5 }),
  })
  .chain((params) =>
    fc
      .tuple(
        teachersArb(params.teacherCount),
        subjectsArb(params.subjectCount),
        classesArb(params.classCount),
        roomsArb(params.roomCount),
        daysArb(params.dayCount),
        periodDefinitionsArb(params.periodCount),
        assignmentsArb(
          params.assignmentCount,
          params.teacherCount,
          params.classCount,
          params.subjectCount,
        ),
        teacherAvailabilityArb(
          params.availabilityCount,
          params.teacherCount,
          params.dayCount,
          params.periodCount,
        ),
        roomConstraintsArb(
          params.roomConstraintCount,
          params.subjectCount,
          params.roomCount,
        ),
      )
      .map(
        ([
          teachers,
          subjects,
          classes,
          rooms,
          days,
          periodDefinitions,
          assignments,
          availability,
          roomConstraints,
        ]) => ({
          institution: 'NBK School',
          schoolId: 'school-1',
          semesterId: 'semester-1',
          teachers,
          subjects,
          classes,
          rooms,
          days,
          periodDefinitions,
          teachingAssignments: assignments,
          teacherAvailability: availability,
          roomConstraints,
        }),
      ),
  );

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: fet-generation-pipeline, Property 9: Deterministic XML Serialization', () => {
  let exporter: FetInputExporterService;

  beforeAll(() => {
    exporter = new FetInputExporterService();
  });

  /**
   * **Validates: Requirements 12.1**
   *
   * For any valid FetInputData, invoking the FET_Input_Exporter's export function
   * twice with identical input SHALL produce byte-identical XML output.
   */
  it('should produce byte-identical XML when export is called twice with the same input', () => {
    fc.assert(
      fc.property(fetInputDataArb, (input: FetInputData) => {
        // Skip if assignments were all deduplicated away (edge case)
        if (input.teachingAssignments.length === 0) return;

        // First export
        const result1 = exporter.export(input);

        // Second export with identical input
        const result2 = exporter.export(input);

        // Verify byte-identical XML output (strict string equality)
        expect(result1.xml).toBe(result2.xml);

        // Verify activityMap deep-equals
        expect(result1.activityMap.size).toBe(result2.activityMap.size);
        for (const [key, value] of result1.activityMap) {
          const otherValue = result2.activityMap.get(key);
          expect(otherValue).toBeDefined();
          expect(otherValue).toEqual(value);
        }
      }),
      { numRuns: 100, verbose: true },
    );
  });
});
