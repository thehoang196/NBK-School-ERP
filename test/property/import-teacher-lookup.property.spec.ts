import * as fc from 'fast-check';
import { IsNull, In } from 'typeorm';
import {
  TimetableImportProcessor,
  TeacherResolveResult,
} from '../../src/modules/import-export/processors/timetable-import.processor';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';

/**
 * Property-Based Tests for Cross-School Teacher Lookup During Import
 *
 * Property 16: Cross-School Teacher Lookup Completeness
 * For any teacher that exists in any school within an Organization, looking up
 * by their employeeCode from any importing school within the same Organization
 * SHALL find that teacher.
 *
 * Property 17: Import Assignment Verification
 * For any teacher found via cross-school lookup, the import SHALL succeed if and
 * only if an active Teacher_School_Assignment exists for the importing school.
 * Otherwise, a validation error with suggestion SHALL be returned.
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate a random UUID v4 */
const uuidArb = fc.uuid({ version: 4 });

/** Generate an employee code (alphanumeric, 3-10 chars) */
const employeeCodeArb = fc.stringMatching(/^[A-Z]{2,4}[0-9]{3,6}$/);

/** Generate a teacher full name */
const fullNameArb = fc.string({ minLength: 3, maxLength: 50 });

/** Generate a school name */
const schoolNameArb = fc.string({ minLength: 3, maxLength: 30 });

// ─── Types ────────────────────────────────────────────────────────────────────

interface MockTeacher {
  id: string;
  employeeCode: string;
  fullName: string;
  schoolId: string;
  deletedAt: null;
  school?: { name: string } | null;
}

interface MockSchool {
  id: string;
  parentSchoolId: string | null;
  deletedAt: null;
}

interface MockTSA {
  teacherId: string;
  schoolId: string;
  status: AssignmentStatus;
  deletedAt: null;
}

// ─── Service Factory ──────────────────────────────────────────────────────────

/**
 * Creates a TimetableImportProcessor instance with mocked repositories
 * that return controlled data based on the test scenario.
 */
function createProcessor(config: {
  teachers: MockTeacher[];
  schools: MockSchool[];
  tsaRecords: MockTSA[];
}): TimetableImportProcessor {
  const { teachers, schools, tsaRecords } = config;

  const processor = Object.create(
    TimetableImportProcessor.prototype,
  ) as TimetableImportProcessor;

  // Mock teacherRepo.findOne
  const mockTeacherRepo = {
    findOne: async (options: any): Promise<MockTeacher | null> => {
      const where = options.where;
      const found = teachers.find((t) => {
        if (t.deletedAt !== null) return false;
        if (where.employeeCode && t.employeeCode !== where.employeeCode)
          return false;
        // Handle In() operator for schoolId
        if (
          where.schoolId &&
          typeof where.schoolId === 'object' &&
          where.schoolId._type === 'in'
        ) {
          if (!where.schoolId._value.includes(t.schoolId)) return false;
        } else if (where.schoolId && t.schoolId !== where.schoolId) {
          return false;
        }
        return true;
      });
      if (found && options.relations?.school) {
        return { ...found, school: found.school || { name: 'Mock School' } };
      }
      return found || null;
    },
  };

  // Mock schoolRepo.find — returns schools belonging to the organization
  const mockSchoolRepo = {
    find: async (options: any): Promise<MockSchool[]> => {
      const whereConditions = Array.isArray(options.where)
        ? options.where
        : [options.where];
      const results: MockSchool[] = [];
      for (const where of whereConditions) {
        const matching = schools.filter((s) => {
          if (s.deletedAt !== null) return false;
          if (where.id && s.id !== where.id) return false;
          if (where.parentSchoolId && s.parentSchoolId !== where.parentSchoolId)
            return false;
          return true;
        });
        results.push(...matching);
      }
      // Deduplicate
      const seen = new Set<string>();
      return results.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    },
  };

  // Mock tsaRepo.findOne
  const mockTsaRepo = {
    findOne: async (options: any): Promise<MockTSA | null> => {
      const where = options.where;
      return (
        tsaRecords.find((tsa) => {
          if (tsa.deletedAt !== null) return false;
          if (where.teacherId && tsa.teacherId !== where.teacherId)
            return false;
          if (where.schoolId && tsa.schoolId !== where.schoolId) return false;
          return true;
        }) || null
      );
    },
  };

  // Inject mocked repositories via Object.defineProperty
  Object.defineProperty(processor, 'teacherRepo', { value: mockTeacherRepo });
  Object.defineProperty(processor, 'schoolRepo', { value: mockSchoolRepo });
  Object.defineProperty(processor, 'tsaRepo', { value: mockTsaRepo });
  Object.defineProperty(processor, 'logger', {
    value: { debug: () => {}, warn: () => {}, error: () => {} },
  });

  return processor;
}

// ============================================================================
// Property 16: Cross-School Teacher Lookup Completeness
// ============================================================================

describe('Feature: cross-campus-teaching | Property 16: Cross-School Teacher Lookup Completeness', () => {
  /**
   * Property 16a: Teacher found in importing school → immediately resolved.
   *
   * For any teacher that exists in the importing school itself, resolveTeacher
   * SHALL return success with that teacher (local lookup path).
   *
   * **Validates: Requirements 6.1**
   */
  describe('Property 16a: Teacher in importing school is always found', () => {
    it('resolveTeacher finds teacher locally without cross-school lookup', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          async (
            teacherId,
            importingSchoolId,
            organizationId,
            employeeCode,
            fullName,
          ) => {
            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: importingSchoolId,
              deletedAt: null,
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords: [],
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            expect(result.success).toBe(true);
            expect(result.teacher).toBeDefined();
            expect(result.teacher!.employeeCode).toBe(employeeCode);
            expect(result.teacher!.id).toBe(teacherId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 16b: Teacher exists in another school within the Organization
   * → cross-school lookup finds them.
   *
   * For any teacher that exists at school B (not the importing school A),
   * resolveTeacher SHALL find the teacher across the organization by employeeCode.
   * The result depends on the TSA status (tested in Property 17).
   *
   * **Validates: Requirements 6.1**
   */
  describe('Property 16b: Teacher in other org school is found via cross-school lookup', () => {
    it('resolveTeacher finds teacher in another school within same org', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          schoolNameArb,
          async (
            teacherId,
            importingSchoolId,
            otherSchoolId,
            organizationId,
            employeeCode,
            fullName,
            schoolName,
          ) => {
            // Precondition: importing school and other school are different
            fc.pre(importingSchoolId !== otherSchoolId);
            fc.pre(importingSchoolId !== organizationId);
            fc.pre(otherSchoolId !== organizationId);

            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: otherSchoolId,
              deletedAt: null,
              school: { name: schoolName },
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
              {
                id: otherSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            // With active TSA → teacher should be found and resolved
            const tsaRecords: MockTSA[] = [
              {
                teacherId,
                schoolId: importingSchoolId,
                status: AssignmentStatus.ACTIVE,
                deletedAt: null,
              },
            ];

            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords,
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            // Teacher is found (lookup completeness)
            expect(result.success).toBe(true);
            expect(result.teacher).toBeDefined();
            expect(result.teacher!.employeeCode).toBe(employeeCode);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 16c: Teacher NOT found in any school in the organization
   * → NOT_FOUND error returned.
   *
   * For any employeeCode that does not match any teacher in any school within
   * the Organization, resolveTeacher SHALL return error code NOT_FOUND.
   *
   * **Validates: Requirements 6.1**
   */
  describe('Property 16c: Non-existent teacher returns NOT_FOUND', () => {
    it('resolveTeacher returns NOT_FOUND for non-existent employeeCode', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          employeeCodeArb,
          async (importingSchoolId, organizationId, employeeCode) => {
            fc.pre(importingSchoolId !== organizationId);

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            // No teachers at all
            const processor = createProcessor({
              teachers: [],
              schools,
              tsaRecords: [],
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.code).toBe('NOT_FOUND');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 16d: For any number of schools within an org, if the teacher exists
   * in ANY of them, the cross-school lookup SHALL find them.
   *
   * **Validates: Requirements 6.1**
   */
  describe('Property 16d: Teacher is discoverable from any importing school in the org', () => {
    it('teacher is found regardless of which org school is importing', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          uuidArb,
          fc.array(uuidArb, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 0 }),
          async (
            teacherId,
            employeeCode,
            fullName,
            organizationId,
            schoolIds,
            teacherSchoolIdx,
          ) => {
            const uniqueSchoolIds = [
              ...new Set(schoolIds.filter((s) => s !== organizationId)),
            ];
            fc.pre(uniqueSchoolIds.length >= 2);

            // Teacher resides in one school
            const teacherSchoolIndex =
              teacherSchoolIdx % uniqueSchoolIds.length;
            const teacherSchoolId = uniqueSchoolIds[teacherSchoolIndex];

            // Import from a different school
            const importingSchoolIndex =
              (teacherSchoolIndex + 1) % uniqueSchoolIds.length;
            const importingSchoolId = uniqueSchoolIds[importingSchoolIndex];

            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: teacherSchoolId,
              deletedAt: null,
              school: { name: 'Test School' },
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              ...uniqueSchoolIds.map((id) => ({
                id,
                parentSchoolId: organizationId,
                deletedAt: null as null,
              })),
            ];

            const tsaRecords: MockTSA[] = [
              {
                teacherId,
                schoolId: importingSchoolId,
                status: AssignmentStatus.ACTIVE,
                deletedAt: null,
              },
            ];

            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords,
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            // Teacher SHALL be found across org
            expect(result.success).toBe(true);
            expect(result.teacher).toBeDefined();
            expect(result.teacher!.employeeCode).toBe(employeeCode);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Property 17: Import Assignment Verification
// ============================================================================

describe('Feature: cross-campus-teaching | Property 17: Import Assignment Verification', () => {
  /**
   * Property 17a: Teacher found cross-school WITH active TSA → import succeeds.
   *
   * For any teacher found via cross-school lookup that has an active
   * Teacher_School_Assignment for the importing school, resolveTeacher
   * SHALL return success=true.
   *
   * **Validates: Requirements 6.2**
   */
  describe('Property 17a: Active TSA exists → import succeeds', () => {
    it('cross-school teacher with active TSA resolves successfully', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          schoolNameArb,
          async (
            teacherId,
            importingSchoolId,
            otherSchoolId,
            organizationId,
            employeeCode,
            fullName,
            schoolName,
          ) => {
            fc.pre(importingSchoolId !== otherSchoolId);
            fc.pre(importingSchoolId !== organizationId);
            fc.pre(otherSchoolId !== organizationId);

            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: otherSchoolId,
              deletedAt: null,
              school: { name: schoolName },
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
              {
                id: otherSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            // Active TSA for importing school
            const tsaRecords: MockTSA[] = [
              {
                teacherId,
                schoolId: importingSchoolId,
                status: AssignmentStatus.ACTIVE,
                deletedAt: null,
              },
            ];

            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords,
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            expect(result.success).toBe(true);
            expect(result.teacher).toBeDefined();
            expect(result.teacher!.id).toBe(teacherId);
            expect(result.error).toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 17b: Teacher found cross-school WITHOUT any TSA → NO_ASSIGNMENT error.
   *
   * For any teacher found via cross-school lookup that has NO
   * Teacher_School_Assignment for the importing school, resolveTeacher
   * SHALL return error code NO_ASSIGNMENT with a suggestion.
   *
   * **Validates: Requirements 6.3**
   */
  describe('Property 17b: No TSA exists → NO_ASSIGNMENT error with suggestion', () => {
    it('cross-school teacher without TSA returns NO_ASSIGNMENT error', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          schoolNameArb,
          async (
            teacherId,
            importingSchoolId,
            otherSchoolId,
            organizationId,
            employeeCode,
            fullName,
            schoolName,
          ) => {
            fc.pre(importingSchoolId !== otherSchoolId);
            fc.pre(importingSchoolId !== organizationId);
            fc.pre(otherSchoolId !== organizationId);

            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: otherSchoolId,
              deletedAt: null,
              school: { name: schoolName },
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
              {
                id: otherSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            // NO TSA records for importing school
            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords: [],
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.code).toBe('NO_ASSIGNMENT');
            expect(result.error!.suggestion).toBeDefined();
            expect(result.error!.suggestion!.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 17c: Teacher found cross-school with INACTIVE TSA → ASSIGNMENT_INACTIVE error.
   *
   * For any teacher found via cross-school lookup that has an inactive (not active)
   * Teacher_School_Assignment for the importing school, resolveTeacher
   * SHALL return error code ASSIGNMENT_INACTIVE.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  describe('Property 17c: Inactive TSA → ASSIGNMENT_INACTIVE error', () => {
    it('cross-school teacher with inactive TSA returns ASSIGNMENT_INACTIVE error', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          schoolNameArb,
          async (
            teacherId,
            importingSchoolId,
            otherSchoolId,
            organizationId,
            employeeCode,
            fullName,
            schoolName,
          ) => {
            fc.pre(importingSchoolId !== otherSchoolId);
            fc.pre(importingSchoolId !== organizationId);
            fc.pre(otherSchoolId !== organizationId);

            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: otherSchoolId,
              deletedAt: null,
              school: { name: schoolName },
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
              {
                id: otherSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            // INACTIVE TSA for importing school
            const tsaRecords: MockTSA[] = [
              {
                teacherId,
                schoolId: importingSchoolId,
                status: AssignmentStatus.INACTIVE,
                deletedAt: null,
              },
            ];

            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords,
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.code).toBe('ASSIGNMENT_INACTIVE');
            expect(result.error!.suggestion).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 17d: Import succeeds if and only if active TSA exists.
   *
   * The bidirectional property: for any teacher found in a different school,
   * success=true ⟺ active TSA exists for importing school.
   * This covers the complete "if and only if" requirement.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  describe('Property 17d: success ⟺ active TSA exists (bidirectional)', () => {
    it('import succeeds iff active TSA exists for the importing school', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          schoolNameArb,
          fc.constantFrom<AssignmentStatus | 'none'>(
            AssignmentStatus.ACTIVE,
            AssignmentStatus.INACTIVE,
            'none',
          ),
          async (
            teacherId,
            importingSchoolId,
            otherSchoolId,
            organizationId,
            employeeCode,
            fullName,
            schoolName,
            tsaState,
          ) => {
            fc.pre(importingSchoolId !== otherSchoolId);
            fc.pre(importingSchoolId !== organizationId);
            fc.pre(otherSchoolId !== organizationId);

            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: otherSchoolId,
              deletedAt: null,
              school: { name: schoolName },
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
              {
                id: otherSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            const tsaRecords: MockTSA[] =
              tsaState === 'none'
                ? []
                : [
                    {
                      teacherId,
                      schoolId: importingSchoolId,
                      status: tsaState,
                      deletedAt: null,
                    },
                  ];

            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords,
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            // Bidirectional: success ⟺ active TSA
            if (tsaState === AssignmentStatus.ACTIVE) {
              expect(result.success).toBe(true);
              expect(result.teacher).toBeDefined();
            } else {
              expect(result.success).toBe(false);
              expect(result.error).toBeDefined();
              if (tsaState === AssignmentStatus.INACTIVE) {
                expect(result.error!.code).toBe('ASSIGNMENT_INACTIVE');
              } else {
                expect(result.error!.code).toBe('NO_ASSIGNMENT');
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 17e: Local teacher (in importing school) always succeeds without TSA check.
   *
   * For any teacher that already belongs to the importing school, resolveTeacher
   * SHALL succeed regardless of TSA records (local resolution bypasses TSA check).
   *
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Property 17e: Local teacher always succeeds without TSA check', () => {
    it('teacher in importing school succeeds regardless of TSA state', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          employeeCodeArb,
          fullNameArb,
          fc.constantFrom<AssignmentStatus | 'none'>(
            AssignmentStatus.ACTIVE,
            AssignmentStatus.INACTIVE,
            'none',
          ),
          async (
            teacherId,
            importingSchoolId,
            organizationId,
            employeeCode,
            fullName,
            tsaState,
          ) => {
            fc.pre(importingSchoolId !== organizationId);

            const teacher: MockTeacher = {
              id: teacherId,
              employeeCode,
              fullName,
              schoolId: importingSchoolId,
              deletedAt: null,
            };

            const schools: MockSchool[] = [
              { id: organizationId, parentSchoolId: null, deletedAt: null },
              {
                id: importingSchoolId,
                parentSchoolId: organizationId,
                deletedAt: null,
              },
            ];

            // TSA state shouldn't matter for local teacher
            const tsaRecords: MockTSA[] =
              tsaState === 'none'
                ? []
                : [
                    {
                      teacherId,
                      schoolId: importingSchoolId,
                      status: tsaState,
                      deletedAt: null,
                    },
                  ];

            const processor = createProcessor({
              teachers: [teacher],
              schools,
              tsaRecords,
            });

            const result = await processor.resolveTeacher(
              employeeCode,
              importingSchoolId,
              organizationId,
            );

            // Local teacher always succeeds — TSA not checked
            expect(result.success).toBe(true);
            expect(result.teacher).toBeDefined();
            expect(result.teacher!.id).toBe(teacherId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
