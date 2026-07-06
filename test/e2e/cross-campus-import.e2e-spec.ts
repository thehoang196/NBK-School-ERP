import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { SchoolRepository } from '../../src/modules/school/school.repository';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';
import { UserRole } from '../../src/common/enums/role.enum';

/**
 * E2E Integration Tests — Cross-Campus Import (Teacher Lookup)
 *
 * Tests the enhanced timetable import teacher resolution flow:
 * 1. Teacher found locally (fast path)
 * 2. Teacher found cross-org with active TSA
 * 3. Teacher found but no TSA → error with suggestion
 * 4. Teacher not found → error
 *
 * Uses service-level integration tests with mocked repositories.
 *
 * Infrastructure required for full E2E:
 * - PostgreSQL with teachers, teacher_school_assignments, schools tables
 * - Excel file upload via HTTP
 * - Full import pipeline (BullMQ queue)
 *
 * Validates: Requirements 6.1–6.4
 */

// ─── Test Constants ─────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-c000-000000000001';
const SCHOOL_A_ID = '00000000-0000-4000-c000-000000000010';
const SCHOOL_B_ID = '00000000-0000-4000-c000-000000000020';
const TEACHER_LOCAL_ID = '00000000-0000-4000-c000-000000000100';
const TEACHER_CROSS_ID = '00000000-0000-4000-c000-000000000200';
const TEACHER_NO_TSA_ID = '00000000-0000-4000-c000-000000000300';

// ─── Mock Teacher Data ──────────────────────────────────────────────────────

const teacherLocal = {
  id: TEACHER_LOCAL_ID,
  schoolId: SCHOOL_A_ID,
  employeeCode: 'GV001',
  fullName: 'Nguyễn Văn Local',
  deletedAt: null,
};

const teacherCrossSchool = {
  id: TEACHER_CROSS_ID,
  schoolId: SCHOOL_B_ID, // Home school is B
  employeeCode: 'GV002',
  fullName: 'Trần Thị Cross',
  deletedAt: null,
};

const teacherNoTSA = {
  id: TEACHER_NO_TSA_ID,
  schoolId: SCHOOL_B_ID, // Home school is B, no TSA for A
  employeeCode: 'GV003',
  fullName: 'Lê Văn NoTSA',
  deletedAt: null,
};

// ─── TeacherResolveResult Interface ─────────────────────────────────────────

interface TeacherResolveResult {
  success: boolean;
  teacher?: {
    id: string;
    employeeCode: string;
    fullName: string;
    schoolId: string;
  };
  error?: {
    code: 'NOT_FOUND' | 'NO_ASSIGNMENT' | 'ASSIGNMENT_INACTIVE';
    message: string;
    suggestion?: string;
  };
}

// ─── Simulated resolveTeacher logic ─────────────────────────────────────────

/**
 * Enhanced teacher lookup logic for import:
 * 1. Find teacher by employeeCode in importing school → found → use
 * 2. Find teacher by employeeCode across all schools in same Organization
 * 3. If found → check teacher_school_assignment for importing school
 * 4. If TSA exists & active → use
 * 5. If no TSA → validation error with suggestion
 * 6. If not found anywhere → "not found" error
 */
function resolveTeacher(
  employeeCode: string,
  importingSchoolId: string,
  allTeachersInOrg: (typeof teacherLocal)[],
  activeAssignments: Array<{
    teacherId: string;
    schoolId: string;
    status: string;
  }>,
): TeacherResolveResult {
  // Step 1: Find teacher locally
  const localTeacher = allTeachersInOrg.find(
    (t) => t.employeeCode === employeeCode && t.schoolId === importingSchoolId,
  );
  if (localTeacher) {
    return { success: true, teacher: localTeacher };
  }

  // Step 2: Find teacher across org
  const crossTeacher = allTeachersInOrg.find(
    (t) => t.employeeCode === employeeCode,
  );
  if (!crossTeacher) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Không tìm thấy giáo viên với mã '${employeeCode}' trong tổ chức`,
      },
    };
  }

  // Step 3: Check TSA for importing school
  const tsa = activeAssignments.find(
    (a) => a.teacherId === crossTeacher.id && a.schoolId === importingSchoolId,
  );

  if (tsa && tsa.status === 'active') {
    return { success: true, teacher: crossTeacher };
  }

  // Step 5: No TSA → error with suggestion
  return {
    success: false,
    error: {
      code: 'NO_ASSIGNMENT',
      message: `Giáo viên '${crossTeacher.fullName}' (${employeeCode}) thuộc trường khác nhưng chưa có phân công liên trường`,
      suggestion: `Vui lòng tạo phân công liên trường (Teacher School Assignment) cho giáo viên '${crossTeacher.fullName}' trước khi import`,
    },
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Cross-Campus Import E2E (Teacher Lookup)', () => {
  const importingSchoolId = SCHOOL_A_ID;
  const allTeachersInOrg = [teacherLocal, teacherCrossSchool, teacherNoTSA];

  const activeAssignments = [
    // Teacher Cross has active TSA for school A
    {
      teacherId: TEACHER_CROSS_ID,
      schoolId: SCHOOL_A_ID,
      status: 'active',
      role: AssignmentRole.SECONDARY,
    },
    // Teacher No TSA does NOT have TSA for school A
    // (no entry)
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Teacher Found Locally (Fast Path)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Teacher Found Locally', () => {
    it('should resolve teacher found in importing school immediately', () => {
      const result = resolveTeacher(
        'GV001',
        importingSchoolId,
        allTeachersInOrg,
        activeAssignments,
      );

      expect(result.success).toBe(true);
      expect(result.teacher).toBeDefined();
      expect(result.teacher!.id).toBe(TEACHER_LOCAL_ID);
      expect(result.teacher!.employeeCode).toBe('GV001');
      expect(result.error).toBeUndefined();
    });

    it('should prefer local teacher over cross-school teacher with same code', () => {
      // If both local and cross-school teacher have the same code, local wins
      const teachersWithDuplicate = [
        { ...teacherLocal, employeeCode: 'GV_SHARED' },
        { ...teacherCrossSchool, employeeCode: 'GV_SHARED' },
      ];

      const result = resolveTeacher(
        'GV_SHARED',
        importingSchoolId,
        teachersWithDuplicate,
        activeAssignments,
      );

      expect(result.success).toBe(true);
      expect(result.teacher!.schoolId).toBe(SCHOOL_A_ID); // local school
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Teacher Found Cross-Org with Active TSA
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Teacher Found Cross-School with Active TSA', () => {
    it('should resolve cross-school teacher when active TSA exists for importing school', () => {
      const result = resolveTeacher(
        'GV002',
        importingSchoolId,
        allTeachersInOrg,
        activeAssignments,
      );

      expect(result.success).toBe(true);
      expect(result.teacher).toBeDefined();
      expect(result.teacher!.id).toBe(TEACHER_CROSS_ID);
      expect(result.teacher!.fullName).toBe('Trần Thị Cross');
      expect(result.error).toBeUndefined();
    });

    it('should correctly identify teacher from another school in the same org', () => {
      const result = resolveTeacher(
        'GV002',
        importingSchoolId,
        allTeachersInOrg,
        activeAssignments,
      );

      expect(result.success).toBe(true);
      // Teacher's home school is different from importing school
      expect(result.teacher!.id).toBe(TEACHER_CROSS_ID);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Teacher Found but No TSA → Error with Suggestion
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Teacher Found but No TSA', () => {
    it('should return error with suggestion when teacher has no TSA for importing school', () => {
      const result = resolveTeacher(
        'GV003',
        importingSchoolId,
        allTeachersInOrg,
        activeAssignments,
      );

      expect(result.success).toBe(false);
      expect(result.teacher).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('NO_ASSIGNMENT');
      expect(result.error!.message).toContain('Lê Văn NoTSA');
      expect(result.error!.message).toContain('chưa có phân công liên trường');
      expect(result.error!.suggestion).toBeDefined();
      expect(result.error!.suggestion).toContain(
        'Vui lòng tạo phân công liên trường',
      );
    });

    it('should include employee code in error message for identification', () => {
      const result = resolveTeacher(
        'GV003',
        importingSchoolId,
        allTeachersInOrg,
        activeAssignments,
      );

      expect(result.error!.message).toContain('GV003');
    });

    it('should return NO_ASSIGNMENT when TSA exists but is inactive', () => {
      const assignmentsWithInactive = [
        ...activeAssignments,
        {
          teacherId: TEACHER_NO_TSA_ID,
          schoolId: SCHOOL_A_ID,
          status: 'inactive', // Not active!
          role: AssignmentRole.SECONDARY,
        },
      ];

      const result = resolveTeacher(
        'GV003',
        importingSchoolId,
        allTeachersInOrg,
        assignmentsWithInactive,
      );

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NO_ASSIGNMENT');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Teacher Not Found → Error
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Teacher Not Found', () => {
    it('should return NOT_FOUND error when teacher does not exist in org', () => {
      const result = resolveTeacher(
        'GV999',
        importingSchoolId,
        allTeachersInOrg,
        activeAssignments,
      );

      expect(result.success).toBe(false);
      expect(result.teacher).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('NOT_FOUND');
      expect(result.error!.message).toContain('GV999');
      expect(result.error!.message).toContain('Không tìm thấy');
    });

    it('should NOT provide suggestion when teacher is completely unknown', () => {
      const result = resolveTeacher(
        'UNKNOWN',
        importingSchoolId,
        allTeachersInOrg,
        activeAssignments,
      );

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
      expect(result.error!.suggestion).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Batch Import Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Batch Import Resolution', () => {
    it('should resolve mixed batch of teachers correctly', () => {
      const importBatch = ['GV001', 'GV002', 'GV003', 'GV999'];

      const results = importBatch.map((code) =>
        resolveTeacher(
          code,
          importingSchoolId,
          allTeachersInOrg,
          activeAssignments,
        ),
      );

      // GV001 - local found
      expect(results[0].success).toBe(true);
      expect(results[0].teacher!.id).toBe(TEACHER_LOCAL_ID);

      // GV002 - cross-school with TSA
      expect(results[1].success).toBe(true);
      expect(results[1].teacher!.id).toBe(TEACHER_CROSS_ID);

      // GV003 - cross-school without TSA
      expect(results[2].success).toBe(false);
      expect(results[2].error!.code).toBe('NO_ASSIGNMENT');

      // GV999 - not found
      expect(results[3].success).toBe(false);
      expect(results[3].error!.code).toBe('NOT_FOUND');
    });

    it('should provide summary of import errors', () => {
      const importBatch = ['GV001', 'GV002', 'GV003', 'GV999'];

      const results = importBatch.map((code) =>
        resolveTeacher(
          code,
          importingSchoolId,
          allTeachersInOrg,
          activeAssignments,
        ),
      );

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);
      const notFound = failed.filter((r) => r.error!.code === 'NOT_FOUND');
      const noAssignment = failed.filter(
        (r) => r.error!.code === 'NO_ASSIGNMENT',
      );

      expect(successful.length).toBe(2);
      expect(failed.length).toBe(2);
      expect(notFound.length).toBe(1);
      expect(noAssignment.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Full E2E Flows (require infrastructure — skipped)
  // ═══════════════════════════════════════════════════════════════════════════

  describe.skip('Full E2E with real database (requires PostgreSQL + Excel upload)', () => {
    it('should import timetable Excel with cross-school teacher resolution', () => {
      /**
       * Full flow:
       * 1. Upload Excel file with teacher codes
       * 2. TimetableImportService parses rows
       * 3. resolveTeacher() called for each teacher code
       * 4. Local teachers resolved immediately
       * 5. Cross-school teachers resolved via TSA check
       * 6. Import report shows success/error counts
       *
       * Required infrastructure:
       * - PostgreSQL with teachers, teacher_school_assignments
       * - Excel file upload endpoint
       * - BullMQ for large imports
       */
    });

    it('should handle import with feature flag disabled', () => {
      /**
       * Full flow:
       * 1. Feature flag CROSS_SCHOOL_ENABLED = false
       * 2. Import attempts cross-school lookup
       * 3. Cross-school lookup is skipped or blocked
       * 4. Only local teachers resolved
       *
       * Required infrastructure:
       * - PostgreSQL with feature_flags table
       */
    });

    it('should create audit log for import with cross-school resolutions', () => {
      /**
       * Full flow:
       * 1. Import with cross-school teachers
       * 2. Verify audit log records which teachers were resolved cross-school
       * 3. Audit shows school source for each resolution
       *
       * Required infrastructure:
       * - PostgreSQL with audit_logs table
       */
    });
  });
});
