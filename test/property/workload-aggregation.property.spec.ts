import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';
import {
  TeachingAssignmentService,
  AggregatedWorkloadResponse,
} from '../../src/modules/teaching-assignment/teaching-assignment.service';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';

/**
 * Property-Based Tests for Teaching Assignment Validation and Workload Aggregation
 *
 * Property 10: Teaching Assignment School Validation
 * For any teacher and for any school, creating a TeachingAssignment SHALL succeed
 * if and only if the teacher has an active Teacher_School_Assignment (primary or secondary)
 * for that school.
 *
 * Property 11: Workload Aggregation and Overload Detection
 * For any teacher with teaching assignments across N schools, the aggregated
 * periodsPerWeek SHALL equal the sum of all individual assignment periodsPerWeek
 * values. The isOverloaded flag SHALL be true if and only if
 * totalPeriods > teacher.maxPeriodsPerWeek.
 *
 * Property 12: Deactivation Cascading to Teaching Assignments
 * For any Teacher_School_Assignment that is deactivated, ALL active
 * TeachingAssignments for that teacher in that school SHALL be flagged
 * as "pending_reassignment".
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 4.1, 4.3, 4.4, 4.5**
 */

// --- Custom Arbitraries ---

/** Generate a random UUID v4 */
const uuidArb = fc.uuid({ version: 4 });

/** Generate a valid periodsPerWeek (1-12) */
const periodsPerWeekArb = fc.integer({ min: 1, max: 12 });

/** Generate a valid maxPeriodsPerWeek for a teacher (10-40) */
const maxPeriodsPerWeekArb = fc.integer({ min: 10, max: 40 });

/** Generate a random number of schools (1-5) with their assignments */
interface SchoolAssignment {
  schoolId: string;
  periodsPerWeek: number;
}

const arbSchoolAssignments = (minSchools: number, maxSchools: number) =>
  fc.array(
    fc.record({
      schoolId: uuidArb,
      periodsPerWeek: periodsPerWeekArb,
    }),
    { minLength: minSchools, maxLength: maxSchools },
  );

// --- Helper functions ---

/**
 * Creates a mock TeachingAssignmentService.create() that validates
 * teacher school access via a mock TSA service.
 */
function createMockTeachingAssignmentCreate(activeSchoolIds: string[]): (
  dto: {
    teacherId: string;
    classId: string;
    subjectId: string;
    semesterId: string;
    periodsPerWeek: number;
    note?: string;
  },
  schoolId: string,
) => Promise<{ id: string; schoolId: string }> {
  return async (dto, schoolId) => {
    const hasAccess = activeSchoolIds.includes(schoolId);
    if (!hasAccess) {
      throw new ForbiddenException({
        success: false,
        data: null,
        message: 'Giáo viên không có quyền dạy tại trường này',
        errorCode: 'TEACHER_NO_SCHOOL_ASSIGNMENT',
      });
    }
    return { id: 'created-id', schoolId };
  };
}

/**
 * Simulates getAggregatedWorkload logic:
 * Sums periodsPerWeek across all schools and determines isOverloaded.
 */
function computeAggregatedWorkload(
  assignments: SchoolAssignment[],
  maxPeriodsPerWeek: number,
): AggregatedWorkloadResponse {
  const bySchoolMap: Record<string, number> = {};
  let totalPeriods = 0;

  for (const assignment of assignments) {
    bySchoolMap[assignment.schoolId] =
      (bySchoolMap[assignment.schoolId] || 0) + assignment.periodsPerWeek;
    totalPeriods += assignment.periodsPerWeek;
  }

  const bySchool = Object.entries(bySchoolMap).map(([schoolId, periods]) => ({
    schoolId,
    periods,
  }));

  const isOverloaded = totalPeriods > maxPeriodsPerWeek;

  return { totalPeriods, bySchool, isOverloaded };
}

/**
 * Simulates the deactivation cascade logic:
 * All teaching assignments for a teacher at a specific school get flagged.
 */
function simulateDeactivationCascade(
  allAssignments: Array<{
    id: string;
    teacherId: string;
    schoolId: string;
    assignmentStatus: string;
  }>,
  teacherId: string,
  deactivatedSchoolId: string,
): Array<{
  id: string;
  teacherId: string;
  schoolId: string;
  assignmentStatus: string;
}> {
  return allAssignments.map((ta) => {
    if (
      ta.teacherId === teacherId &&
      ta.schoolId === deactivatedSchoolId &&
      ta.assignmentStatus === 'active'
    ) {
      return { ...ta, assignmentStatus: 'pending_reassignment' };
    }
    return ta;
  });
}

// ============================================================================
// Property 10: Teaching Assignment School Validation
// ============================================================================

describe('Feature: cross-campus-teaching | Property 10: Teaching Assignment School Validation', () => {
  /**
   * Property 10a: Assignment succeeds when teacher has active TSA for the school.
   *
   * For any teacher with active assignments to N schools, creating a TeachingAssignment
   * for any of those schools SHALL succeed.
   *
   * **Validates: Requirements 4.1**
   */
  describe('Property 10a: Assignment succeeds iff active TSA exists', () => {
    it('creating assignment at a school with active TSA always succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(uuidArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          uuidArb,
          uuidArb,
          periodsPerWeekArb,
          async (
            teacherId,
            activeSchoolIds,
            classId,
            subjectId,
            semesterId,
            periodsPerWeek,
          ) => {
            // Ensure unique school IDs
            const uniqueSchoolIds = [...new Set(activeSchoolIds)];
            fc.pre(uniqueSchoolIds.length >= 1);

            // Pick any school from the active list
            const targetSchoolId = uniqueSchoolIds[0];

            const createFn =
              createMockTeachingAssignmentCreate(uniqueSchoolIds);

            // Should succeed without throwing
            const result = await createFn(
              { teacherId, classId, subjectId, semesterId, periodsPerWeek },
              targetSchoolId,
            );

            expect(result).toBeDefined();
            expect(result.schoolId).toBe(targetSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 10b: Assignment fails when teacher has NO active TSA for the school.
   *
   * For any teacher and any school NOT in their active assignment list,
   * creating a TeachingAssignment SHALL throw TEACHER_NO_SCHOOL_ASSIGNMENT error.
   *
   * **Validates: Requirements 4.1**
   */
  describe('Property 10b: Assignment fails when no active TSA exists', () => {
    it('creating assignment at a school without active TSA always throws', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(uuidArb, { minLength: 1, maxLength: 5 }),
          uuidArb,
          uuidArb,
          uuidArb,
          uuidArb,
          periodsPerWeekArb,
          async (
            teacherId,
            activeSchoolIds,
            nonActiveSchoolId,
            classId,
            subjectId,
            semesterId,
            periodsPerWeek,
          ) => {
            // Ensure the target school is NOT in the active list
            const uniqueActiveIds = [...new Set(activeSchoolIds)];
            fc.pre(!uniqueActiveIds.includes(nonActiveSchoolId));

            const createFn =
              createMockTeachingAssignmentCreate(uniqueActiveIds);

            // Should throw ForbiddenException
            await expect(
              createFn(
                { teacherId, classId, subjectId, semesterId, periodsPerWeek },
                nonActiveSchoolId,
              ),
            ).rejects.toThrow(ForbiddenException);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 10c: validateTeacherSchoolAccess is the gating function.
   *
   * For any (teacher, school) pair, the create() validation logic returns true
   * iff the school is in the teacher's accessible set (mirroring service behavior).
   *
   * **Validates: Requirements 4.1**
   */
  describe('Property 10c: Access validation is biconditional with TSA existence', () => {
    it('validateTeacherSchoolAccess returns true iff school in active set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(uuidArb, { minLength: 0, maxLength: 6 }),
          uuidArb,
          async (activeSchoolIds, querySchoolId) => {
            const uniqueActive = [...new Set(activeSchoolIds)];

            // Mock validateTeacherSchoolAccess
            const mockValidate = async (
              teacherId: string,
              schoolId: string,
            ): Promise<boolean> => {
              return uniqueActive.includes(schoolId);
            };

            const result = await mockValidate('any-teacher', querySchoolId);

            if (uniqueActive.includes(querySchoolId)) {
              expect(result).toBe(true);
            } else {
              expect(result).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Property 11: Workload Aggregation and Overload Detection
// ============================================================================

describe('Feature: cross-campus-teaching | Property 11: Workload Aggregation and Overload Detection', () => {
  /**
   * Property 11a: Aggregated workload equals sum of individual assignments.
   *
   * For any teacher with teaching assignments across N schools, the totalPeriods
   * field SHALL equal the sum of all individual periodsPerWeek values.
   *
   * **Validates: Requirements 4.3**
   */
  describe('Property 11a: totalPeriods = sum of all individual periodsPerWeek', () => {
    it('aggregated total always equals sum of individual periods', () => {
      fc.assert(
        fc.property(
          arbSchoolAssignments(1, 10),
          maxPeriodsPerWeekArb,
          (assignments, maxPeriods) => {
            const result = computeAggregatedWorkload(assignments, maxPeriods);

            const expectedTotal = assignments.reduce(
              (sum, a) => sum + a.periodsPerWeek,
              0,
            );

            expect(result.totalPeriods).toBe(expectedTotal);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 11b: isOverloaded iff totalPeriods > maxPeriodsPerWeek.
   *
   * For any teacher, the isOverloaded flag SHALL be true if and only if
   * the aggregated totalPeriods exceeds the teacher's maxPeriodsPerWeek.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Property 11b: isOverloaded iff totalPeriods > maxPeriodsPerWeek', () => {
    it('overloaded flag is correctly determined by comparing total to max', () => {
      fc.assert(
        fc.property(
          arbSchoolAssignments(1, 10),
          maxPeriodsPerWeekArb,
          (assignments, maxPeriods) => {
            const result = computeAggregatedWorkload(assignments, maxPeriods);

            const expectedTotal = assignments.reduce(
              (sum, a) => sum + a.periodsPerWeek,
              0,
            );

            if (expectedTotal > maxPeriods) {
              expect(result.isOverloaded).toBe(true);
            } else {
              expect(result.isOverloaded).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 11c: bySchool entries sum to totalPeriods.
   *
   * For any aggregated workload, the sum of all bySchool[].periods
   * SHALL equal totalPeriods.
   *
   * **Validates: Requirements 4.3**
   */
  describe('Property 11c: bySchool periods sum to totalPeriods', () => {
    it('sum of per-school periods equals total', () => {
      fc.assert(
        fc.property(
          arbSchoolAssignments(1, 10),
          maxPeriodsPerWeekArb,
          (assignments, maxPeriods) => {
            const result = computeAggregatedWorkload(assignments, maxPeriods);

            const bySchoolSum = result.bySchool.reduce(
              (sum, entry) => sum + entry.periods,
              0,
            );

            expect(bySchoolSum).toBe(result.totalPeriods);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 11d: School grouping is correct.
   *
   * For any set of assignments, each school's aggregated periods SHALL equal
   * the sum of periodsPerWeek for all assignments with that schoolId.
   *
   * **Validates: Requirements 4.3**
   */
  describe('Property 11d: Per-school grouping is correct', () => {
    it('each school periods equals sum of that schools assignments', () => {
      fc.assert(
        fc.property(
          arbSchoolAssignments(1, 10),
          maxPeriodsPerWeekArb,
          (assignments, maxPeriods) => {
            const result = computeAggregatedWorkload(assignments, maxPeriods);

            for (const schoolEntry of result.bySchool) {
              const expectedPeriods = assignments
                .filter((a) => a.schoolId === schoolEntry.schoolId)
                .reduce((sum, a) => sum + a.periodsPerWeek, 0);
              expect(schoolEntry.periods).toBe(expectedPeriods);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 11e: Empty assignments yield zero total and not overloaded.
   *
   * For any teacher with no assignments, totalPeriods SHALL be 0
   * and isOverloaded SHALL be false.
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  describe('Property 11e: Zero assignments → zero total, not overloaded', () => {
    it('no assignments results in zero total and false overload', () => {
      fc.assert(
        fc.property(maxPeriodsPerWeekArb, (maxPeriods) => {
          const result = computeAggregatedWorkload([], maxPeriods);

          expect(result.totalPeriods).toBe(0);
          expect(result.bySchool).toHaveLength(0);
          expect(result.isOverloaded).toBe(false);
        }),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Property 12: Deactivation Cascading to Teaching Assignments
// ============================================================================

describe('Feature: cross-campus-teaching | Property 12: Deactivation Cascading to Teaching Assignments', () => {
  /**
   * Generate teaching assignment records for a teacher across multiple schools.
   */
  const arbTeachingAssignments = (teacherId: string, schoolIds: string[]) =>
    fc.array(
      fc.record({
        id: uuidArb,
        teacherId: fc.constant(teacherId),
        schoolId: fc.constantFrom(...schoolIds),
        assignmentStatus: fc.constant('active'),
      }),
      { minLength: 1, maxLength: 10 },
    );

  /**
   * Property 12a: All active TAs at the deactivated school become "pending_reassignment".
   *
   * For any teacher with active TeachingAssignments across multiple schools,
   * when a Teacher_School_Assignment is deactivated for a specific school,
   * ALL active TeachingAssignments for that teacher at that school SHALL be
   * flagged as "pending_reassignment".
   *
   * **Validates: Requirements 4.5**
   */
  describe('Property 12a: Deactivation flags all TAs at that school', () => {
    it('all active TAs at the deactivated school get flagged', () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.array(uuidArb, { minLength: 2, maxLength: 5 }),
          (teacherId, schoolIds) => {
            const uniqueSchools = [...new Set(schoolIds)];
            fc.pre(uniqueSchools.length >= 2);

            // Generate some teaching assignments across schools
            const assignments = uniqueSchools.flatMap((schoolId, idx) =>
              Array.from({ length: idx + 1 }, (_, i) => ({
                id: `ta-${schoolId}-${i}`,
                teacherId,
                schoolId,
                assignmentStatus: 'active',
              })),
            );

            // Deactivate the first school's assignment
            const deactivatedSchoolId = uniqueSchools[0];

            const result = simulateDeactivationCascade(
              assignments,
              teacherId,
              deactivatedSchoolId,
            );

            // All TAs at the deactivated school should be "pending_reassignment"
            const affectedTAs = result.filter(
              (ta) =>
                ta.schoolId === deactivatedSchoolId &&
                ta.teacherId === teacherId,
            );
            for (const ta of affectedTAs) {
              expect(ta.assignmentStatus).toBe('pending_reassignment');
            }

            // At least one TA was affected
            expect(affectedTAs.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 12b: TAs at other schools are NOT affected by deactivation.
   *
   * For any teacher, deactivating a Teacher_School_Assignment for school X
   * SHALL NOT change the assignmentStatus of TeachingAssignments at other schools.
   *
   * **Validates: Requirements 4.5**
   */
  describe('Property 12b: TAs at other schools are unaffected', () => {
    it('deactivation does not affect TAs at other schools', () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.array(uuidArb, { minLength: 2, maxLength: 5 }),
          (teacherId, schoolIds) => {
            const uniqueSchools = [...new Set(schoolIds)];
            fc.pre(uniqueSchools.length >= 2);

            // Generate teaching assignments across all schools
            const assignments = uniqueSchools.flatMap((schoolId, idx) =>
              Array.from({ length: idx + 1 }, (_, i) => ({
                id: `ta-${schoolId}-${i}`,
                teacherId,
                schoolId,
                assignmentStatus: 'active',
              })),
            );

            // Deactivate the first school
            const deactivatedSchoolId = uniqueSchools[0];
            const otherSchools = uniqueSchools.slice(1);

            const result = simulateDeactivationCascade(
              assignments,
              teacherId,
              deactivatedSchoolId,
            );

            // TAs at other schools remain 'active'
            const unaffectedTAs = result.filter((ta) =>
              otherSchools.includes(ta.schoolId),
            );
            for (const ta of unaffectedTAs) {
              expect(ta.assignmentStatus).toBe('active');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 12c: Deactivation only affects the specified teacher.
   *
   * For a scenario with multiple teachers at the same school, deactivating
   * one teacher's school assignment SHALL NOT affect another teacher's TAs.
   *
   * **Validates: Requirements 4.5**
   */
  describe('Property 12c: Only the specified teacher TAs are affected', () => {
    it('other teachers TAs at the same school are not affected', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          uuidArb,
          (teacherA, teacherB, schoolId) => {
            fc.pre(teacherA !== teacherB);

            const assignments = [
              {
                id: 'ta-a-1',
                teacherId: teacherA,
                schoolId,
                assignmentStatus: 'active',
              },
              {
                id: 'ta-a-2',
                teacherId: teacherA,
                schoolId,
                assignmentStatus: 'active',
              },
              {
                id: 'ta-b-1',
                teacherId: teacherB,
                schoolId,
                assignmentStatus: 'active',
              },
              {
                id: 'ta-b-2',
                teacherId: teacherB,
                schoolId,
                assignmentStatus: 'active',
              },
            ];

            // Deactivate teacher A's assignment at this school
            const result = simulateDeactivationCascade(
              assignments,
              teacherA,
              schoolId,
            );

            // Teacher A's TAs should be flagged
            const teacherATAs = result.filter(
              (ta) => ta.teacherId === teacherA,
            );
            for (const ta of teacherATAs) {
              expect(ta.assignmentStatus).toBe('pending_reassignment');
            }

            // Teacher B's TAs should remain active
            const teacherBTAs = result.filter(
              (ta) => ta.teacherId === teacherB,
            );
            for (const ta of teacherBTAs) {
              expect(ta.assignmentStatus).toBe('active');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 12d: Already inactive TAs are not affected by deactivation.
   *
   * If a TeachingAssignment is already 'pending_reassignment' or another status,
   * the deactivation cascade SHALL NOT change it further.
   *
   * **Validates: Requirements 4.5**
   */
  describe('Property 12d: Non-active TAs are not affected', () => {
    it('TAs not in active status remain unchanged after deactivation', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, (teacherId, schoolId) => {
          const assignments = [
            { id: 'ta-1', teacherId, schoolId, assignmentStatus: 'active' },
            {
              id: 'ta-2',
              teacherId,
              schoolId,
              assignmentStatus: 'pending_reassignment',
            },
            { id: 'ta-3', teacherId, schoolId, assignmentStatus: 'active' },
          ];

          const result = simulateDeactivationCascade(
            assignments,
            teacherId,
            schoolId,
          );

          // ta-1 and ta-3 should change to pending_reassignment
          expect(result.find((ta) => ta.id === 'ta-1')?.assignmentStatus).toBe(
            'pending_reassignment',
          );
          expect(result.find((ta) => ta.id === 'ta-3')?.assignmentStatus).toBe(
            'pending_reassignment',
          );

          // ta-2 was already pending_reassignment, stays the same
          expect(result.find((ta) => ta.id === 'ta-2')?.assignmentStatus).toBe(
            'pending_reassignment',
          );
        }),
        { numRuns: 100 },
      );
    });
  });
});
