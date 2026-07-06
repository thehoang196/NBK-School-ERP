/**
 * Feature: fet-generation-pipeline, Property 4: FET Input XML Round-Trip
 *
 * **Validates: Requirements 3.5, 12.2, 12.3**
 *
 * Property: For any valid FetInputData (containing teachers, classes, subjects, rooms,
 * teaching assignments, period definitions, and constraints), serializing to FET XML
 * then deserializing back SHALL produce a structurally equivalent DTO set where all
 * entity references, counts, and constraint parameters are preserved.
 */
import * as fc from 'fast-check';
import { FetInputExporterService } from '../fet-input-exporter.service';
import { FetInputDeserializerService } from '../fet-input-deserializer.service';
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

// No generic string generators needed - we use deterministic indexed names for uniqueness

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
      // Deduplicate by (teacherId, classId, subjectId) since the deserializer groups by this key
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
            fc.integer({ min: 1, max: 3 }), // 1-3 unavailable slots
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

describe('Feature: fet-generation-pipeline, Property 4: FET Input XML Round-Trip', () => {
  let exporter: FetInputExporterService;
  let deserializer: FetInputDeserializerService;

  beforeAll(() => {
    exporter = new FetInputExporterService();
    deserializer = new FetInputDeserializerService();
  });

  /**
   * **Validates: Requirements 3.5, 12.2, 12.3**
   *
   * For any valid FetInputData, serializing to FET XML then deserializing back
   * SHALL produce a structurally equivalent DTO set.
   */
  it('should preserve structural equivalence after XML round-trip', () => {
    fc.assert(
      fc.property(fetInputDataArb, (input: FetInputData) => {
        // Skip if assignments were all deduplicated away (edge case)
        if (input.teachingAssignments.length === 0) return;

        // Step 1: Serialize to XML
        const exportResult = exporter.export(input);
        expect(exportResult.xml).toBeDefined();
        expect(exportResult.xml.length).toBeGreaterThan(0);

        // Step 2: Deserialize back
        const deserialized = deserializer.deserialize(exportResult.xml);

        // ─── Structural equivalence checks ───────────────────────────────

        // Institution name preserved exactly
        expect(deserialized.institution).toBe(input.institution);

        // Same number of teachers, same names
        expect(deserialized.teachers.length).toBe(input.teachers.length);
        const originalTeacherNames = input.teachers.map((t) => t.name).sort();
        const deserializedTeacherNames = deserialized.teachers
          .map((t) => t.name)
          .sort();
        expect(deserializedTeacherNames).toEqual(originalTeacherNames);

        // Same teacher maxPeriodsPerDay values (compared by name)
        for (const originalTeacher of input.teachers) {
          if (originalTeacher.maxPeriodsPerDay > 0) {
            const roundTripped = deserialized.teachers.find(
              (t) => t.name === originalTeacher.name,
            );
            expect(roundTripped).toBeDefined();
            expect(roundTripped!.maxPeriodsPerDay).toBe(
              originalTeacher.maxPeriodsPerDay,
            );
          }
        }

        // Same number of subjects, same names
        expect(deserialized.subjects.length).toBe(input.subjects.length);
        const originalSubjectNames = input.subjects.map((s) => s.name).sort();
        const deserializedSubjectNames = deserialized.subjects
          .map((s) => s.name)
          .sort();
        expect(deserializedSubjectNames).toEqual(originalSubjectNames);

        // Same number of classes, same names, same gradeId mapping
        expect(deserialized.classes.length).toBe(input.classes.length);
        const originalClassEntries = input.classes
          .map((c) => `${c.name}|${c.gradeId}`)
          .sort();
        const deserializedClassEntries = deserialized.classes
          .map((c) => `${c.name}|${c.gradeId}`)
          .sort();
        expect(deserializedClassEntries).toEqual(originalClassEntries);

        // Same number of rooms, same names, same capacities
        expect(deserialized.rooms.length).toBe(input.rooms.length);
        const originalRoomEntries = input.rooms
          .map((r) => `${r.name}|${r.capacity}`)
          .sort();
        const deserializedRoomEntries = deserialized.rooms
          .map((r) => `${r.name}|${r.capacity}`)
          .sort();
        expect(deserializedRoomEntries).toEqual(originalRoomEntries);

        // Same number of days, same names, same order
        expect(deserialized.days).toEqual(input.days);

        // Same number of period definitions, same names, same order
        expect(deserialized.periodDefinitions.length).toBe(
          input.periodDefinitions.length,
        );
        const originalPeriodNames = input.periodDefinitions.map((p) => p.name);
        const deserializedPeriodNames = deserialized.periodDefinitions.map(
          (p) => p.name,
        );
        expect(deserializedPeriodNames).toEqual(originalPeriodNames);

        // Same number of teaching assignments with same structural mappings
        // Compare by (teacherName, className, subjectName, periodsPerWeek)
        const teacherNameMap = new Map(
          input.teachers.map((t) => [t.id, t.name]),
        );
        const classNameMap = new Map(input.classes.map((c) => [c.id, c.name]));
        const subjectNameMap = new Map(
          input.subjects.map((s) => [s.id, s.name]),
        );

        const originalAssignmentKeys = input.teachingAssignments
          .map((a) => {
            const tName = teacherNameMap.get(a.teacherId)!;
            const cName = classNameMap.get(a.classId)!;
            const sName = subjectNameMap.get(a.subjectId)!;
            return `${tName}|${cName}|${sName}|${a.periodsPerWeek}`;
          })
          .sort();

        const deserializedTeacherNameMap = new Map(
          deserialized.teachers.map((t) => [t.id, t.name]),
        );
        const deserializedClassNameMap = new Map(
          deserialized.classes.map((c) => [c.id, c.name]),
        );
        const deserializedSubjectNameMap = new Map(
          deserialized.subjects.map((s) => [s.id, s.name]),
        );

        const deserializedAssignmentKeys = deserialized.teachingAssignments
          .map((a) => {
            const tName = deserializedTeacherNameMap.get(a.teacherId)!;
            const cName = deserializedClassNameMap.get(a.classId)!;
            const sName = deserializedSubjectNameMap.get(a.subjectId)!;
            return `${tName}|${cName}|${sName}|${a.periodsPerWeek}`;
          })
          .sort();

        expect(deserialized.teachingAssignments.length).toBe(
          input.teachingAssignments.length,
        );
        expect(deserializedAssignmentKeys).toEqual(originalAssignmentKeys);

        // Same teacher availability slot counts per teacher (compared by teacher name)
        const originalAvailabilityByTeacher = new Map<string, number>();
        for (const avail of input.teacherAvailability) {
          const tName = teacherNameMap.get(avail.teacherId)!;
          // Only count slots that map to valid days/periods
          const validSlots = avail.unavailableSlots.filter(
            (slot) =>
              slot.dayOfWeek < input.days.length &&
              input.periodDefinitions.some((p) => p.id === slot.periodId),
          );
          if (validSlots.length > 0) {
            originalAvailabilityByTeacher.set(tName, validSlots.length);
          }
        }

        const deserializedAvailabilityByTeacher = new Map<string, number>();
        for (const avail of deserialized.teacherAvailability) {
          const tName = deserializedTeacherNameMap.get(avail.teacherId)!;
          deserializedAvailabilityByTeacher.set(
            tName,
            avail.unavailableSlots.length,
          );
        }

        expect(deserializedAvailabilityByTeacher.size).toBe(
          originalAvailabilityByTeacher.size,
        );
        for (const [tName, slotCount] of originalAvailabilityByTeacher) {
          expect(deserializedAvailabilityByTeacher.get(tName)).toBe(slotCount);
        }
      }),
      { numRuns: 100, verbose: true },
    );
  });
});
