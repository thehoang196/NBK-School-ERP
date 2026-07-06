/**
 * Property 5: FET Input Validation Completeness
 *
 * For any FetInputData with one or more required fields missing or inconsistent
 * (e.g., teaching assignment referencing non-existent teacher, empty teacher list,
 * assignment with zero periods), the FET_Input_Exporter SHALL reject the input
 * and return specific descriptive errors identifying each invalid field.
 *
 * Feature: fet-generation-pipeline, Property 5: FET Input Validation Completeness
 * Validates: Requirements 3.3
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

describe('Feature: fet-generation-pipeline, Property 5: FET Input Validation Completeness', () => {
  let exporter: FetInputExporterService;

  beforeEach(() => {
    exporter = new FetInputExporterService();
  });

  // ─── Generators ──────────────────────────────────────────────────────────

  const uuidArb = fc.uuid();

  const teacherArb: fc.Arbitrary<TeacherDto> = fc.record({
    id: uuidArb,
    name: fc.string({ minLength: 1, maxLength: 30 }),
    maxPeriodsPerDay: fc.integer({ min: 1, max: 8 }),
  });

  const classArb: fc.Arbitrary<ClassDto> = fc.record({
    id: uuidArb,
    name: fc.string({ minLength: 1, maxLength: 20 }),
    gradeId: uuidArb,
  });

  const subjectArb: fc.Arbitrary<SubjectDto> = fc.record({
    id: uuidArb,
    name: fc.string({ minLength: 1, maxLength: 30 }),
  });

  const roomArb: fc.Arbitrary<RoomDto> = fc.record({
    id: uuidArb,
    name: fc.string({ minLength: 1, maxLength: 20 }),
    capacity: fc.integer({ min: 10, max: 50 }),
  });

  const periodDefArb: fc.Arbitrary<PeriodDefinitionDto> = fc.record({
    id: uuidArb,
    periodNumber: fc.integer({ min: 1, max: 10 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    sessionId: uuidArb,
  });

  const dayArb = fc.constantFrom(
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  );

  /**
   * Generate a valid FetInputData where all references are consistent.
   */
  function validFetInputDataArb(): fc.Arbitrary<FetInputData> {
    return fc
      .record({
        teachers: fc.array(teacherArb, { minLength: 1, maxLength: 5 }),
        classes: fc.array(classArb, { minLength: 1, maxLength: 5 }),
        subjects: fc.array(subjectArb, { minLength: 1, maxLength: 5 }),
        rooms: fc.array(roomArb, { minLength: 1, maxLength: 3 }),
        periodDefinitions: fc.array(periodDefArb, {
          minLength: 1,
          maxLength: 6,
        }),
        days: fc.array(dayArb, { minLength: 1, maxLength: 6 }),
      })
      .chain((base) => {
        // Build teaching assignments that reference valid entities
        const assignmentArb: fc.Arbitrary<TeachingAssignmentDto> = fc.record({
          id: uuidArb,
          teacherId: fc.constantFrom(...base.teachers.map((t) => t.id)),
          classId: fc.constantFrom(...base.classes.map((c) => c.id)),
          subjectId: fc.constantFrom(...base.subjects.map((s) => s.id)),
          periodsPerWeek: fc.integer({ min: 1, max: 10 }),
        });

        return fc
          .array(assignmentArb, { minLength: 1, maxLength: 5 })
          .map((assignments) => ({
            institution: 'NBK Test School',
            schoolId: 'school-001',
            semesterId: 'semester-001',
            teachers: base.teachers,
            classes: base.classes,
            subjects: base.subjects,
            rooms: base.rooms,
            periodDefinitions: base.periodDefinitions,
            days: base.days,
            teachingAssignments: assignments,
            teacherAvailability: [],
            roomConstraints: [],
          }));
      });
  }

  // ─── Corruption Strategies ───────────────────────────────────────────────

  type CorruptionFn = (input: FetInputData) => FetInputData;

  /** Strategy 1: Empty a required array */
  function emptyRequiredArray(
    input: FetInputData,
    arrayIndex: number,
  ): FetInputData {
    const copy = { ...input };
    const arrays = [
      'teachers',
      'classes',
      'subjects',
      'teachingAssignments',
      'periodDefinitions',
      'days',
    ] as const;
    const targetArray = arrays[arrayIndex % arrays.length];
    return { ...copy, [targetArray]: [] };
  }

  /** Strategy 2: Set periodsPerWeek to 0 or negative on a random assignment */
  function corruptPeriodsPerWeek(
    input: FetInputData,
    seed: number,
  ): FetInputData {
    if (input.teachingAssignments.length === 0)
      return emptyRequiredArray(input, 3);
    const assignments = [...input.teachingAssignments];
    const idx = seed % assignments.length;
    assignments[idx] = {
      ...assignments[idx],
      periodsPerWeek: -(Math.abs(seed % 10) + 0), // 0 or negative
    };
    return { ...input, teachingAssignments: assignments };
  }

  /** Strategy 3: Replace teacherId in a random assignment with a fake UUID */
  function corruptAssignmentTeacherId(
    input: FetInputData,
    fakeId: string,
    idx: number,
  ): FetInputData {
    if (input.teachingAssignments.length === 0)
      return emptyRequiredArray(input, 3);
    const assignments = [...input.teachingAssignments];
    const targetIdx = idx % assignments.length;
    assignments[targetIdx] = { ...assignments[targetIdx], teacherId: fakeId };
    return { ...input, teachingAssignments: assignments };
  }

  /** Strategy 4: Replace classId in a random assignment with a fake UUID */
  function corruptAssignmentClassId(
    input: FetInputData,
    fakeId: string,
    idx: number,
  ): FetInputData {
    if (input.teachingAssignments.length === 0)
      return emptyRequiredArray(input, 3);
    const assignments = [...input.teachingAssignments];
    const targetIdx = idx % assignments.length;
    assignments[targetIdx] = { ...assignments[targetIdx], classId: fakeId };
    return { ...input, teachingAssignments: assignments };
  }

  /** Strategy 5: Replace subjectId in a random assignment with a fake UUID */
  function corruptAssignmentSubjectId(
    input: FetInputData,
    fakeId: string,
    idx: number,
  ): FetInputData {
    if (input.teachingAssignments.length === 0)
      return emptyRequiredArray(input, 3);
    const assignments = [...input.teachingAssignments];
    const targetIdx = idx % assignments.length;
    assignments[targetIdx] = { ...assignments[targetIdx], subjectId: fakeId };
    return { ...input, teachingAssignments: assignments };
  }

  /** Strategy 6: Add teacher availability with non-existent teacherId */
  function corruptTeacherAvailability(
    input: FetInputData,
    fakeId: string,
  ): FetInputData {
    const availability: TeacherAvailabilityDto = {
      teacherId: fakeId,
      unavailableSlots: [{ dayOfWeek: 0, periodId: 'period-fake' }],
    };
    return {
      ...input,
      teacherAvailability: [...input.teacherAvailability, availability],
    };
  }

  /** Strategy 7: Add room constraint with non-existent roomId or subjectId */
  function corruptRoomConstraint(
    input: FetInputData,
    fakeRoomId: string,
    fakeSubjectId: string,
  ): FetInputData {
    const constraint: RoomConstraintDto = {
      roomId: fakeRoomId,
      subjectId: fakeSubjectId,
      weight: 100,
    };
    return {
      ...input,
      roomConstraints: [...input.roomConstraints, constraint],
    };
  }

  // ─── Property Test ───────────────────────────────────────────────────────

  it('should reject any corrupted FetInputData with specific descriptive errors', () => {
    fc.assert(
      fc.property(
        validFetInputDataArb(),
        fc.integer({ min: 1, max: 7 }), // which corruption strategy to apply
        fc.integer({ min: 0, max: 100 }), // seed for randomizing corruption target
        uuidArb, // fake UUID for reference corruption
        (validInput, strategy, seed, fakeId) => {
          let corruptedInput: FetInputData;

          switch (strategy) {
            case 1:
              corruptedInput = emptyRequiredArray(validInput, seed);
              break;
            case 2:
              corruptedInput = corruptPeriodsPerWeek(validInput, seed);
              break;
            case 3:
              corruptedInput = corruptAssignmentTeacherId(
                validInput,
                fakeId,
                seed,
              );
              break;
            case 4:
              corruptedInput = corruptAssignmentClassId(
                validInput,
                fakeId,
                seed,
              );
              break;
            case 5:
              corruptedInput = corruptAssignmentSubjectId(
                validInput,
                fakeId,
                seed,
              );
              break;
            case 6:
              corruptedInput = corruptTeacherAvailability(validInput, fakeId);
              break;
            case 7:
              corruptedInput = corruptRoomConstraint(
                validInput,
                fakeId,
                fakeId,
              );
              break;
            default:
              corruptedInput = emptyRequiredArray(validInput, seed);
          }

          const result = exporter.validate(corruptedInput);

          // The validation must detect the corruption
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);

          // Each error must have a non-empty field and message
          for (const error of result.errors) {
            expect(error.field).toBeTruthy();
            expect(error.field.length).toBeGreaterThan(0);
            expect(error.message).toBeTruthy();
            expect(error.message.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
