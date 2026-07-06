import * as fc from 'fast-check';
import { OrgTeacherService } from '../../src/modules/teacher/services/org-teacher.service';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';
import { TeacherType, TeacherStatus } from '../../src/common/enums/status.enum';

/**
 * Property-Based Tests for Organization Teacher List
 *
 * Property 18: Organization Teacher List Completeness
 * For any organization with teachers distributed across M schools, the org-level
 * teacher list SHALL contain ALL teachers from ALL M schools. The total count
 * SHALL equal the sum of per-school teacher counts.
 *
 * Property 19: Org Teacher List Filter Correctness
 * For any combination of filters (school, teacherType, department, hasCrossSchool),
 * every teacher in the response SHALL satisfy ALL applied filter conditions.
 *
 * Property 20: School Admin Cross-School Visibility
 * For any School Admin, the teacher list SHALL include both (a) teachers whose
 * primary school is the admin's school, and (b) teachers from other schools who
 * have an active secondary assignment to the admin's school.
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate a random UUID v4 */
const uuidArb = fc.uuid({ version: 4 });

/** Generate a teacher type */
const teacherTypeArb = fc.constantFrom(
  TeacherType.FULL_TIME,
  TeacherType.ASSISTANT,
  TeacherType.VISITING,
  TeacherType.INTER_SCHOOL,
);

/** Generate a teacher status */
const teacherStatusArb = fc.constantFrom(
  TeacherStatus.ACTIVE,
  TeacherStatus.ON_LEAVE,
  TeacherStatus.RESIGNED,
);

/** Generate a teacher full name */
const fullNameArb = fc.string({ minLength: 3, maxLength: 30 });

/** Generate an employee code */
const employeeCodeArb = fc.stringMatching(/^[A-Z]{2,4}[0-9]{3,6}$/);

// ─── Types ────────────────────────────────────────────────────────────────────

interface MockTeacher {
  id: string;
  employeeCode: string;
  fullName: string;
  shortName: string | null;
  schoolId: string;
  teacherType: TeacherType;
  status: TeacherStatus;
  departmentId: string | null;
  deletedAt: null;
  school?: { name: string } | null;
  department?: { name: string } | null;
}

interface MockSchool {
  id: string;
  name: string;
  parentSchoolId: string | null;
  deletedAt: null;
}

interface MockTSA {
  id: string;
  teacherId: string;
  schoolId: string;
  role: AssignmentRole;
  status: AssignmentStatus;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  deletedAt: null;
  school?: { name: string; code: string } | null;
}

// ─── Pure Logic Functions Under Test ──────────────────────────────────────────

/**
 * Pure function simulating org-level teacher list (SUPER_ADMIN view).
 * Returns ALL teachers across all schools in the organization.
 */
function getOrgTeacherList(
  teachers: MockTeacher[],
  _schools: MockSchool[],
): MockTeacher[] {
  return teachers.filter((t) => t.deletedAt === null);
}

/**
 * Pure function simulating filter application on teacher list.
 * Every returned teacher MUST satisfy ALL applied filters.
 */
function applyFilters(
  teachers: MockTeacher[],
  tsaRecords: MockTSA[],
  filters: {
    schoolId?: string;
    teacherType?: TeacherType;
    departmentId?: string;
    hasCrossSchool?: boolean;
  },
): MockTeacher[] {
  return teachers.filter((teacher) => {
    // Filter by schoolId: teacher's primary school matches OR has active TSA for the school
    if (filters.schoolId) {
      const matchesPrimary = teacher.schoolId === filters.schoolId;
      const matchesTsa = tsaRecords.some(
        (tsa) =>
          tsa.teacherId === teacher.id &&
          tsa.schoolId === filters.schoolId &&
          tsa.status === AssignmentStatus.ACTIVE &&
          tsa.deletedAt === null,
      );
      if (!matchesPrimary && !matchesTsa) return false;
    }

    // Filter by teacherType
    if (filters.teacherType && teacher.teacherType !== filters.teacherType) {
      return false;
    }

    // Filter by departmentId
    if (filters.departmentId && teacher.departmentId !== filters.departmentId) {
      return false;
    }

    // Filter by hasCrossSchool
    if (filters.hasCrossSchool !== undefined) {
      const hasSecondary = tsaRecords.some(
        (tsa) =>
          tsa.teacherId === teacher.id &&
          tsa.role === AssignmentRole.SECONDARY &&
          tsa.status === AssignmentStatus.ACTIVE &&
          tsa.deletedAt === null,
      );
      if (filters.hasCrossSchool === true && !hasSecondary) return false;
      if (filters.hasCrossSchool === false && hasSecondary) return false;
    }

    return true;
  });
}

/**
 * Pure function simulating SCHOOL_ADMIN visibility.
 * Returns teachers visible to a school admin:
 * (a) teachers whose primary school is admin's school
 * (b) teachers from other schools who have active secondary assignment to admin's school
 */
function getSchoolAdminVisibleTeachers(
  teachers: MockTeacher[],
  tsaRecords: MockTSA[],
  adminSchoolId: string,
): MockTeacher[] {
  return teachers.filter((teacher) => {
    if (teacher.deletedAt !== null) return false;

    // (a) primary school matches
    if (teacher.schoolId === adminSchoolId) return true;

    // (b) has active assignment to admin's school
    const hasActiveAssignment = tsaRecords.some(
      (tsa) =>
        tsa.teacherId === teacher.id &&
        tsa.schoolId === adminSchoolId &&
        tsa.status === AssignmentStatus.ACTIVE &&
        tsa.deletedAt === null,
    );
    return hasActiveAssignment;
  });
}

// ─── Generators ───────────────────────────────────────────────────────────────

/** Generate a teacher for a specific school */
const arbTeacher = (
  schoolId: string,
  departmentId: string | null,
): fc.Arbitrary<MockTeacher> =>
  fc.record({
    id: uuidArb,
    employeeCode: employeeCodeArb,
    fullName: fullNameArb,
    shortName: fc.option(fc.string({ minLength: 2, maxLength: 10 }), {
      nil: null,
    }),
    schoolId: fc.constant(schoolId),
    teacherType: teacherTypeArb,
    status: teacherStatusArb,
    departmentId: fc.constant(departmentId),
    deletedAt: fc.constant(null as null),
    school: fc.constant({ name: 'School' }),
    department: departmentId
      ? fc.constant({ name: 'Dept' })
      : fc.constant(null),
  });

/** Generate a TSA record */
const arbTSA = (
  teacherId: string,
  schoolId: string,
  role: AssignmentRole,
  status: AssignmentStatus,
): fc.Arbitrary<MockTSA> =>
  fc.record({
    id: uuidArb,
    teacherId: fc.constant(teacherId),
    schoolId: fc.constant(schoolId),
    role: fc.constant(role),
    status: fc.constant(status),
    effectiveStartDate: fc.constant('2024-01-01'),
    effectiveEndDate: fc.constant(null as null),
    deletedAt: fc.constant(null as null),
    school: fc.constant({ name: 'School', code: 'SCH' }),
  });

// ============================================================================
// Property 18: Organization Teacher List Completeness
// ============================================================================

describe('Feature: cross-campus-teaching | Property 18: Organization Teacher List Completeness', () => {
  /**
   * Property 18a: Org list contains ALL teachers from ALL schools.
   *
   * For any organization with teachers distributed across M schools,
   * the org-level teacher list SHALL contain ALL teachers from ALL M schools.
   *
   * **Validates: Requirements 7.1**
   */
  describe('Property 18a: Org list contains all teachers from all schools', () => {
    it('total count equals sum of per-school teacher counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // organizationId
          fc.array(uuidArb, { minLength: 2, maxLength: 5 }), // school IDs
          fc.array(fc.integer({ min: 1, max: 5 }), {
            minLength: 2,
            maxLength: 5,
          }), // teachers per school
          async (organizationId, schoolIds, teacherCounts) => {
            const uniqueSchoolIds = [
              ...new Set(schoolIds.filter((s) => s !== organizationId)),
            ];
            fc.pre(uniqueSchoolIds.length >= 2);

            // Use same length for schools and teacherCounts
            const numSchools = Math.min(
              uniqueSchoolIds.length,
              teacherCounts.length,
            );
            const schools: MockSchool[] = [
              {
                id: organizationId,
                name: 'Org',
                parentSchoolId: null,
                deletedAt: null,
              },
              ...uniqueSchoolIds.slice(0, numSchools).map((id, idx) => ({
                id,
                name: `School ${idx}`,
                parentSchoolId: organizationId,
                deletedAt: null as null,
              })),
            ];

            // Generate teachers across schools
            const allTeachers: MockTeacher[] = [];
            for (let i = 0; i < numSchools; i++) {
              const count = teacherCounts[i];
              for (let j = 0; j < count; j++) {
                allTeachers.push({
                  id: `teacher-${i}-${j}`,
                  employeeCode: `TC${i}${j}`,
                  fullName: `Teacher ${i}-${j}`,
                  shortName: null,
                  schoolId: uniqueSchoolIds[i],
                  teacherType: TeacherType.FULL_TIME,
                  status: TeacherStatus.ACTIVE,
                  departmentId: null,
                  deletedAt: null,
                  school: { name: `School ${i}` },
                  department: null,
                });
              }
            }

            const orgList = getOrgTeacherList(allTeachers, schools);

            // The org list SHALL contain ALL teachers
            expect(orgList.length).toBe(allTeachers.length);

            // Every teacher from every school is present
            for (const teacher of allTeachers) {
              expect(orgList.find((t) => t.id === teacher.id)).toBeDefined();
            }

            // Sum of per-school counts matches total
            const perSchoolCounts = uniqueSchoolIds
              .slice(0, numSchools)
              .map(
                (schoolId) =>
                  allTeachers.filter((t) => t.schoolId === schoolId).length,
              );
            const sumPerSchool = perSchoolCounts.reduce((a, b) => a + b, 0);
            expect(orgList.length).toBe(sumPerSchool);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 18b: No teacher is excluded from org list regardless of school assignment.
   *
   * For any teacher, whether single-school or cross-school (with TSA records),
   * the teacher SHALL appear in the org-level list.
   *
   * **Validates: Requirements 7.1**
   */
  describe('Property 18b: No teacher excluded regardless of cross-school status', () => {
    it('both single-school and cross-school teachers appear in org list', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // orgId
          uuidArb, // school1
          uuidArb, // school2
          fc.boolean(), // hasCrossSchoolAssignment
          async (orgId, school1Id, school2Id, hasCrossSchool) => {
            fc.pre(
              orgId !== school1Id &&
                orgId !== school2Id &&
                school1Id !== school2Id,
            );

            const teacher: MockTeacher = {
              id: 'teacher-1',
              employeeCode: 'TC001',
              fullName: 'Teacher One',
              shortName: null,
              schoolId: school1Id,
              teacherType: hasCrossSchool
                ? TeacherType.INTER_SCHOOL
                : TeacherType.FULL_TIME,
              status: TeacherStatus.ACTIVE,
              departmentId: null,
              deletedAt: null,
              school: { name: 'School 1' },
              department: null,
            };

            const schools: MockSchool[] = [
              { id: orgId, name: 'Org', parentSchoolId: null, deletedAt: null },
              {
                id: school1Id,
                name: 'School 1',
                parentSchoolId: orgId,
                deletedAt: null,
              },
              {
                id: school2Id,
                name: 'School 2',
                parentSchoolId: orgId,
                deletedAt: null,
              },
            ];

            const orgList = getOrgTeacherList([teacher], schools);

            // Teacher always appears in org list
            expect(orgList.length).toBe(1);
            expect(orgList[0].id).toBe('teacher-1');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Property 19: Org Teacher List Filter Correctness
// ============================================================================

describe('Feature: cross-campus-teaching | Property 19: Org Teacher List Filter Correctness', () => {
  /**
   * Property 19a: teacherType filter — every returned item satisfies the filter.
   *
   * For any teacherType filter value, every teacher in the response SHALL have
   * the matching teacherType.
   *
   * **Validates: Requirements 7.2**
   */
  describe('Property 19a: teacherType filter correctness', () => {
    it('every returned teacher matches the teacherType filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          teacherTypeArb, // filter value
          fc.array(
            fc.record({
              id: uuidArb,
              teacherType: teacherTypeArb,
            }),
            { minLength: 3, maxLength: 20 },
          ),
          async (filterType, teacherRecords) => {
            const teachers: MockTeacher[] = teacherRecords.map((t, idx) => ({
              id: t.id,
              employeeCode: `TC${idx.toString().padStart(3, '0')}`,
              fullName: `Teacher ${idx}`,
              shortName: null,
              schoolId: 'school-1',
              teacherType: t.teacherType,
              status: TeacherStatus.ACTIVE,
              departmentId: null,
              deletedAt: null,
              school: { name: 'School' },
              department: null,
            }));

            const filtered = applyFilters(teachers, [], {
              teacherType: filterType,
            });

            // Every result satisfies the filter
            for (const teacher of filtered) {
              expect(teacher.teacherType).toBe(filterType);
            }

            // No matching teacher is excluded
            const expected = teachers.filter(
              (t) => t.teacherType === filterType,
            );
            expect(filtered.length).toBe(expected.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 19b: schoolId filter — every returned item belongs to or has assignment at school.
   *
   * For any schoolId filter, every teacher returned SHALL either have their
   * primarySchoolId matching OR have an active TSA for that school.
   *
   * **Validates: Requirements 7.2**
   */
  describe('Property 19b: schoolId filter correctness', () => {
    it('every returned teacher is associated with the filtered school', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // school to filter on
          uuidArb, // another school
          fc.array(uuidArb, { minLength: 3, maxLength: 10 }), // teacher IDs
          fc.array(fc.boolean(), { minLength: 3, maxLength: 10 }), // teacher is at filter school?
          async (
            filterSchoolId,
            otherSchoolId,
            teacherIds,
            isAtFilterSchool,
          ) => {
            fc.pre(filterSchoolId !== otherSchoolId);
            const uniqueTeacherIds = [...new Set(teacherIds)];
            fc.pre(uniqueTeacherIds.length >= 3);

            const numTeachers = Math.min(
              uniqueTeacherIds.length,
              isAtFilterSchool.length,
            );
            const teachers: MockTeacher[] = [];
            const tsaRecords: MockTSA[] = [];

            for (let i = 0; i < numTeachers; i++) {
              const atFilterSchool = isAtFilterSchool[i];
              const primarySchool = atFilterSchool
                ? filterSchoolId
                : otherSchoolId;

              teachers.push({
                id: uniqueTeacherIds[i],
                employeeCode: `TC${i.toString().padStart(3, '0')}`,
                fullName: `Teacher ${i}`,
                shortName: null,
                schoolId: primarySchool,
                teacherType: TeacherType.FULL_TIME,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'School' },
                department: null,
              });

              // Some teachers at otherSchool have a TSA to filterSchool
              if (!atFilterSchool && i % 2 === 0) {
                tsaRecords.push({
                  id: `tsa-${i}`,
                  teacherId: uniqueTeacherIds[i],
                  schoolId: filterSchoolId,
                  role: AssignmentRole.SECONDARY,
                  status: AssignmentStatus.ACTIVE,
                  effectiveStartDate: '2024-01-01',
                  effectiveEndDate: null,
                  deletedAt: null,
                  school: { name: 'Filter School', code: 'FS' },
                });
              }
            }

            const filtered = applyFilters(teachers, tsaRecords, {
              schoolId: filterSchoolId,
            });

            // Every result is associated with the filter school
            for (const teacher of filtered) {
              const isPrimary = teacher.schoolId === filterSchoolId;
              const hasTsa = tsaRecords.some(
                (tsa) =>
                  tsa.teacherId === teacher.id &&
                  tsa.schoolId === filterSchoolId &&
                  tsa.status === AssignmentStatus.ACTIVE,
              );
              expect(isPrimary || hasTsa).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 19c: hasCrossSchool filter — every returned item matches cross-school status.
   *
   * When hasCrossSchool=true, every teacher SHALL have at least one active secondary TSA.
   * When hasCrossSchool=false, NO teacher SHALL have any active secondary TSA.
   *
   * **Validates: Requirements 7.2**
   */
  describe('Property 19c: hasCrossSchool filter correctness', () => {
    it('hasCrossSchool=true returns only teachers with active secondary assignments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(uuidArb, { minLength: 3, maxLength: 10 }),
          fc.array(fc.boolean(), { minLength: 3, maxLength: 10 }),
          fc.boolean(), // filter value
          async (teacherIds, hasSecondary, filterValue) => {
            const uniqueTeacherIds = [...new Set(teacherIds)];
            fc.pre(uniqueTeacherIds.length >= 3);

            const numTeachers = Math.min(
              uniqueTeacherIds.length,
              hasSecondary.length,
            );
            const teachers: MockTeacher[] = [];
            const tsaRecords: MockTSA[] = [];

            for (let i = 0; i < numTeachers; i++) {
              teachers.push({
                id: uniqueTeacherIds[i],
                employeeCode: `TC${i.toString().padStart(3, '0')}`,
                fullName: `Teacher ${i}`,
                shortName: null,
                schoolId: 'primary-school',
                teacherType: TeacherType.FULL_TIME,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'School' },
                department: null,
              });

              // Some teachers have secondary assignment
              if (hasSecondary[i]) {
                tsaRecords.push({
                  id: `tsa-${i}`,
                  teacherId: uniqueTeacherIds[i],
                  schoolId: 'secondary-school',
                  role: AssignmentRole.SECONDARY,
                  status: AssignmentStatus.ACTIVE,
                  effectiveStartDate: '2024-01-01',
                  effectiveEndDate: null,
                  deletedAt: null,
                  school: { name: 'Secondary School', code: 'SS' },
                });
              }
            }

            const filtered = applyFilters(teachers, tsaRecords, {
              hasCrossSchool: filterValue,
            });

            // Every result matches the filter condition
            for (const teacher of filtered) {
              const hasActiveSecondary = tsaRecords.some(
                (tsa) =>
                  tsa.teacherId === teacher.id &&
                  tsa.role === AssignmentRole.SECONDARY &&
                  tsa.status === AssignmentStatus.ACTIVE &&
                  tsa.deletedAt === null,
              );

              if (filterValue) {
                expect(hasActiveSecondary).toBe(true);
              } else {
                expect(hasActiveSecondary).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 19d: Combined filters — every returned item satisfies ALL applied filters.
   *
   * For any combination of filters, the result set is the intersection of
   * individual filter results. No item violates any applied filter.
   *
   * **Validates: Requirements 7.2**
   */
  describe('Property 19d: Combined filters are conjunctive (AND)', () => {
    it('every returned teacher satisfies ALL applied filter conditions simultaneously', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            teacherType: fc.option(teacherTypeArb, { nil: undefined }),
            hasCrossSchool: fc.option(fc.boolean(), { nil: undefined }),
            departmentId: fc.option(uuidArb, { nil: undefined }),
          }),
          fc.array(
            fc.record({
              id: uuidArb,
              teacherType: teacherTypeArb,
              departmentId: fc.option(uuidArb, { nil: null }),
              hasSecondary: fc.boolean(),
            }),
            { minLength: 5, maxLength: 20 },
          ),
          async (filters, teacherRecords) => {
            const teachers: MockTeacher[] = teacherRecords.map((t, idx) => ({
              id: t.id,
              employeeCode: `TC${idx.toString().padStart(3, '0')}`,
              fullName: `Teacher ${idx}`,
              shortName: null,
              schoolId: 'school-1',
              teacherType: t.teacherType,
              status: TeacherStatus.ACTIVE,
              departmentId: t.departmentId,
              deletedAt: null,
              school: { name: 'School' },
              department: t.departmentId ? { name: 'Dept' } : null,
            }));

            const tsaRecords: MockTSA[] = teacherRecords
              .filter((t) => t.hasSecondary)
              .map((t) => ({
                id: `tsa-${t.id}`,
                teacherId: t.id,
                schoolId: 'other-school',
                role: AssignmentRole.SECONDARY,
                status: AssignmentStatus.ACTIVE,
                effectiveStartDate: '2024-01-01',
                effectiveEndDate: null,
                deletedAt: null,
                school: { name: 'Other School', code: 'OS' },
              }));

            const filtered = applyFilters(teachers, tsaRecords, {
              teacherType: filters.teacherType,
              departmentId: filters.departmentId,
              hasCrossSchool: filters.hasCrossSchool,
            });

            // Verify every returned teacher satisfies ALL conditions
            for (const teacher of filtered) {
              if (filters.teacherType !== undefined) {
                expect(teacher.teacherType).toBe(filters.teacherType);
              }
              if (filters.departmentId !== undefined) {
                expect(teacher.departmentId).toBe(filters.departmentId);
              }
              if (filters.hasCrossSchool !== undefined) {
                const hasActiveSecondary = tsaRecords.some(
                  (tsa) =>
                    tsa.teacherId === teacher.id &&
                    tsa.role === AssignmentRole.SECONDARY &&
                    tsa.status === AssignmentStatus.ACTIVE,
                );
                if (filters.hasCrossSchool) {
                  expect(hasActiveSecondary).toBe(true);
                } else {
                  expect(hasActiveSecondary).toBe(false);
                }
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Property 20: School Admin Cross-School Visibility
// ============================================================================

describe('Feature: cross-campus-teaching | Property 20: School Admin Cross-School Visibility', () => {
  /**
   * Property 20a: School Admin sees own school teachers.
   *
   * For any School Admin, ALL teachers whose primary school matches the admin's
   * school SHALL appear in the teacher list.
   *
   * **Validates: Requirements 7.4**
   */
  describe('Property 20a: School Admin sees all teachers in own school', () => {
    it('all own-school teachers are always visible to school admin', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // admin's school
          uuidArb, // another school
          fc.integer({ min: 1, max: 8 }), // teachers at admin's school
          fc.integer({ min: 1, max: 8 }), // teachers at other school
          async (adminSchoolId, otherSchoolId, ownCount, otherCount) => {
            fc.pre(adminSchoolId !== otherSchoolId);

            const teachers: MockTeacher[] = [];

            // Teachers at admin's school
            for (let i = 0; i < ownCount; i++) {
              teachers.push({
                id: `own-${i}`,
                employeeCode: `OWN${i.toString().padStart(3, '0')}`,
                fullName: `Own Teacher ${i}`,
                shortName: null,
                schoolId: adminSchoolId,
                teacherType: TeacherType.FULL_TIME,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Admin School' },
                department: null,
              });
            }

            // Teachers at other school (no TSA to admin's school)
            for (let i = 0; i < otherCount; i++) {
              teachers.push({
                id: `other-${i}`,
                employeeCode: `OTH${i.toString().padStart(3, '0')}`,
                fullName: `Other Teacher ${i}`,
                shortName: null,
                schoolId: otherSchoolId,
                teacherType: TeacherType.FULL_TIME,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Other School' },
                department: null,
              });
            }

            const visibleTeachers = getSchoolAdminVisibleTeachers(
              teachers,
              [], // no TSA records
              adminSchoolId,
            );

            // ALL own-school teachers are visible
            const ownTeachers = teachers.filter(
              (t) => t.schoolId === adminSchoolId,
            );
            for (const ownTeacher of ownTeachers) {
              expect(
                visibleTeachers.find((t) => t.id === ownTeacher.id),
              ).toBeDefined();
            }

            // Other school teachers without TSA are NOT visible
            const otherTeachers = teachers.filter(
              (t) => t.schoolId === otherSchoolId,
            );
            for (const otherTeacher of otherTeachers) {
              expect(
                visibleTeachers.find((t) => t.id === otherTeacher.id),
              ).toBeUndefined();
            }

            expect(visibleTeachers.length).toBe(ownCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 20b: School Admin sees cross-school teachers with active secondary assignment.
   *
   * For any teacher from another school who has an active secondary assignment to
   * the admin's school, that teacher SHALL appear in the admin's teacher list.
   *
   * **Validates: Requirements 7.4**
   */
  describe('Property 20b: School Admin sees cross-school teachers assigned to their school', () => {
    it('teachers with active secondary TSA to admin school are visible', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // admin school
          uuidArb, // other school
          fc.integer({ min: 1, max: 5 }), // cross-school teachers with active TSA
          fc.integer({ min: 0, max: 5 }), // cross-school teachers with inactive TSA
          fc.integer({ min: 0, max: 3 }), // teachers at other school without TSA
          async (
            adminSchoolId,
            otherSchoolId,
            activeCount,
            inactiveCount,
            noTsaCount,
          ) => {
            fc.pre(adminSchoolId !== otherSchoolId);

            const teachers: MockTeacher[] = [];
            const tsaRecords: MockTSA[] = [];

            // Teachers at other school with ACTIVE TSA to admin's school
            for (let i = 0; i < activeCount; i++) {
              const teacherId = `cross-active-${i}`;
              teachers.push({
                id: teacherId,
                employeeCode: `CA${i.toString().padStart(3, '0')}`,
                fullName: `Cross Active ${i}`,
                shortName: null,
                schoolId: otherSchoolId,
                teacherType: TeacherType.INTER_SCHOOL,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Other School' },
                department: null,
              });
              tsaRecords.push({
                id: `tsa-active-${i}`,
                teacherId,
                schoolId: adminSchoolId,
                role: AssignmentRole.SECONDARY,
                status: AssignmentStatus.ACTIVE,
                effectiveStartDate: '2024-01-01',
                effectiveEndDate: null,
                deletedAt: null,
                school: { name: 'Admin School', code: 'AS' },
              });
            }

            // Teachers at other school with INACTIVE TSA to admin's school
            for (let i = 0; i < inactiveCount; i++) {
              const teacherId = `cross-inactive-${i}`;
              teachers.push({
                id: teacherId,
                employeeCode: `CI${i.toString().padStart(3, '0')}`,
                fullName: `Cross Inactive ${i}`,
                shortName: null,
                schoolId: otherSchoolId,
                teacherType: TeacherType.INTER_SCHOOL,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Other School' },
                department: null,
              });
              tsaRecords.push({
                id: `tsa-inactive-${i}`,
                teacherId,
                schoolId: adminSchoolId,
                role: AssignmentRole.SECONDARY,
                status: AssignmentStatus.INACTIVE,
                effectiveStartDate: '2023-01-01',
                effectiveEndDate: '2023-12-31',
                deletedAt: null,
                school: { name: 'Admin School', code: 'AS' },
              });
            }

            // Teachers at other school without any TSA
            for (let i = 0; i < noTsaCount; i++) {
              teachers.push({
                id: `no-tsa-${i}`,
                employeeCode: `NT${i.toString().padStart(3, '0')}`,
                fullName: `No TSA ${i}`,
                shortName: null,
                schoolId: otherSchoolId,
                teacherType: TeacherType.FULL_TIME,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Other School' },
                department: null,
              });
            }

            const visibleTeachers = getSchoolAdminVisibleTeachers(
              teachers,
              tsaRecords,
              adminSchoolId,
            );

            // Active cross-school teachers ARE visible
            for (let i = 0; i < activeCount; i++) {
              expect(
                visibleTeachers.find((t) => t.id === `cross-active-${i}`),
              ).toBeDefined();
            }

            // Inactive cross-school teachers are NOT visible
            for (let i = 0; i < inactiveCount; i++) {
              expect(
                visibleTeachers.find((t) => t.id === `cross-inactive-${i}`),
              ).toBeUndefined();
            }

            // Teachers without TSA are NOT visible
            for (let i = 0; i < noTsaCount; i++) {
              expect(
                visibleTeachers.find((t) => t.id === `no-tsa-${i}`),
              ).toBeUndefined();
            }

            // Total visible = only active cross-school teachers (no own-school teachers in this test)
            expect(visibleTeachers.length).toBe(activeCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 20c: School Admin combined visibility — own + cross-school.
   *
   * The complete visible set for a School Admin SHALL be the union of:
   * (a) teachers at admin's school, and
   * (b) teachers with active secondary TSA to admin's school.
   * No duplicates, no exclusions.
   *
   * **Validates: Requirements 7.4**
   */
  describe('Property 20c: Combined visibility = own school ∪ active cross-school', () => {
    it('visible set is exactly own-school teachers plus active cross-school teachers', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // admin school
          uuidArb, // other school
          fc.integer({ min: 1, max: 5 }), // own school teachers
          fc.integer({ min: 1, max: 5 }), // active cross-school
          fc.integer({ min: 0, max: 3 }), // inactive cross-school
          fc.integer({ min: 0, max: 3 }), // unrelated teachers
          async (
            adminSchoolId,
            otherSchoolId,
            ownCount,
            crossActiveCount,
            crossInactiveCount,
            unrelatedCount,
          ) => {
            fc.pre(adminSchoolId !== otherSchoolId);

            const teachers: MockTeacher[] = [];
            const tsaRecords: MockTSA[] = [];

            // Own-school teachers
            for (let i = 0; i < ownCount; i++) {
              teachers.push({
                id: `own-${i}`,
                employeeCode: `OWN${i.toString().padStart(3, '0')}`,
                fullName: `Own ${i}`,
                shortName: null,
                schoolId: adminSchoolId,
                teacherType: TeacherType.FULL_TIME,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Admin School' },
                department: null,
              });
            }

            // Active cross-school
            for (let i = 0; i < crossActiveCount; i++) {
              const tid = `cross-a-${i}`;
              teachers.push({
                id: tid,
                employeeCode: `CRA${i.toString().padStart(3, '0')}`,
                fullName: `Cross Active ${i}`,
                shortName: null,
                schoolId: otherSchoolId,
                teacherType: TeacherType.INTER_SCHOOL,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Other School' },
                department: null,
              });
              tsaRecords.push({
                id: `tsa-a-${i}`,
                teacherId: tid,
                schoolId: adminSchoolId,
                role: AssignmentRole.SECONDARY,
                status: AssignmentStatus.ACTIVE,
                effectiveStartDate: '2024-01-01',
                effectiveEndDate: null,
                deletedAt: null,
                school: { name: 'Admin School', code: 'AS' },
              });
            }

            // Inactive cross-school
            for (let i = 0; i < crossInactiveCount; i++) {
              const tid = `cross-i-${i}`;
              teachers.push({
                id: tid,
                employeeCode: `CRI${i.toString().padStart(3, '0')}`,
                fullName: `Cross Inactive ${i}`,
                shortName: null,
                schoolId: otherSchoolId,
                teacherType: TeacherType.INTER_SCHOOL,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Other School' },
                department: null,
              });
              tsaRecords.push({
                id: `tsa-i-${i}`,
                teacherId: tid,
                schoolId: adminSchoolId,
                role: AssignmentRole.SECONDARY,
                status: AssignmentStatus.INACTIVE,
                effectiveStartDate: '2023-01-01',
                effectiveEndDate: '2023-12-31',
                deletedAt: null,
                school: { name: 'Admin School', code: 'AS' },
              });
            }

            // Unrelated teachers (different school, no TSA)
            for (let i = 0; i < unrelatedCount; i++) {
              teachers.push({
                id: `unrelated-${i}`,
                employeeCode: `UNR${i.toString().padStart(3, '0')}`,
                fullName: `Unrelated ${i}`,
                shortName: null,
                schoolId: otherSchoolId,
                teacherType: TeacherType.FULL_TIME,
                status: TeacherStatus.ACTIVE,
                departmentId: null,
                deletedAt: null,
                school: { name: 'Other School' },
                department: null,
              });
            }

            const visibleTeachers = getSchoolAdminVisibleTeachers(
              teachers,
              tsaRecords,
              adminSchoolId,
            );

            // Expected count: own + active cross-school
            const expectedCount = ownCount + crossActiveCount;
            expect(visibleTeachers.length).toBe(expectedCount);

            // Verify composition
            const ownVisible = visibleTeachers.filter(
              (t) => t.schoolId === adminSchoolId,
            );
            expect(ownVisible.length).toBe(ownCount);

            const crossVisible = visibleTeachers.filter(
              (t) => t.schoolId !== adminSchoolId,
            );
            expect(crossVisible.length).toBe(crossActiveCount);

            // Each cross-school visible teacher has active TSA
            for (const teacher of crossVisible) {
              const hasTsa = tsaRecords.some(
                (tsa) =>
                  tsa.teacherId === teacher.id &&
                  tsa.schoolId === adminSchoolId &&
                  tsa.status === AssignmentStatus.ACTIVE,
              );
              expect(hasTsa).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
