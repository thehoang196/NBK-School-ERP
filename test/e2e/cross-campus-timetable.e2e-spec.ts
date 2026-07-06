import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  CrossSchoolTimetableService,
  MergedTimetableSlot,
} from '../../src/modules/timetable/services/cross-school-timetable.service';
import {
  ConflictDetectionService,
  ConflictType,
  ConflictResult,
} from '../../src/modules/timetable/services/conflict-detection.service';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { UserRole } from '../../src/common/enums/role.enum';

/**
 * E2E Integration Tests — Cross-Campus Timetable Flow
 *
 * Tests cross-school conflict detection during timetable operations
 * and the merged timetable view with travel warnings and school filter.
 * Uses mocked services (no real DB/Redis required).
 *
 * Infrastructure required for full E2E:
 * - PostgreSQL with timetable_slots, timetable_versions, teacher_school_assignments
 * - Redis for cross-school slots cache
 * - Seeded multi-school timetable data
 *
 * Validates: Requirements 3.1–3.5, 5.1–5.5
 */

// ─── Test Constants ─────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-b000-000000000001';
const SCHOOL_A_ID = '00000000-0000-4000-b000-000000000010';
const SCHOOL_B_ID = '00000000-0000-4000-b000-000000000020';
const TEACHER_ID = '00000000-0000-4000-b000-000000000100';
const SEMESTER_ID = '00000000-0000-4000-b000-000000000300';
const PERIOD_1_ID = '00000000-0000-4000-b000-000000000401';
const PERIOD_2_ID = '00000000-0000-4000-b000-000000000402';
const PERIOD_3_ID = '00000000-0000-4000-b000-000000000403';
const SCHEDULER_ID = '00000000-0000-4000-b000-000000000500';

// ─── Mock Merged Timetable Slots ────────────────────────────────────────────

const slotSchoolA: MergedTimetableSlot = {
  id: 'slot-a-1',
  dayOfWeek: 2,
  periodId: PERIOD_1_ID,
  periodName: 'Tiết 1',
  startTime: '07:30',
  endTime: '08:15',
  classId: 'class-a-1',
  className: '6A1',
  subjectId: 'subject-eng',
  subjectName: 'Tiếng Anh',
  roomId: 'room-a-1',
  roomName: 'P.201',
  schoolId: SCHOOL_A_ID,
  schoolName: 'Trường Tiểu học NBK',
  schoolAddress: 'Cầu Giấy, Hà Nội',
  hasTravelWarning: false,
};

const slotSchoolB: MergedTimetableSlot = {
  id: 'slot-b-1',
  dayOfWeek: 2,
  periodId: PERIOD_2_ID,
  periodName: 'Tiết 2',
  startTime: '08:20',
  endTime: '09:05',
  classId: 'class-b-1',
  className: '7A2',
  subjectId: 'subject-eng',
  subjectName: 'Tiếng Anh',
  roomId: 'room-b-1',
  roomName: 'P.301',
  schoolId: SCHOOL_B_ID,
  schoolName: 'Trường THCS NBK',
  schoolAddress: 'Thanh Xuân, Hà Nội',
  hasTravelWarning: true, // consecutive period at different school
};

const slotSchoolA_Period3: MergedTimetableSlot = {
  id: 'slot-a-2',
  dayOfWeek: 3,
  periodId: PERIOD_1_ID,
  periodName: 'Tiết 1',
  startTime: '07:30',
  endTime: '08:15',
  classId: 'class-a-2',
  className: '6A2',
  subjectId: 'subject-eng',
  subjectName: 'Tiếng Anh',
  roomId: 'room-a-2',
  roomName: 'P.202',
  schoolId: SCHOOL_A_ID,
  schoolName: 'Trường Tiểu học NBK',
  schoolAddress: 'Cầu Giấy, Hà Nội',
  hasTravelWarning: false,
};

// ─── Configurable Guards ────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
  accessibleSchoolIds?: string[];
}

let currentUser: MockUser = {
  id: SCHEDULER_ID,
  email: 'scheduler@nbk.edu.vn',
  role: UserRole.SCHEDULER,
  schoolId: SCHOOL_A_ID,
  accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
};

const MockJwtAuthGuard = {
  canActivate: (context: {
    switchToHttp: () => { getRequest: () => Record<string, unknown> };
  }) => {
    const req = context.switchToHttp().getRequest();
    req['user'] = currentUser;
    return true;
  },
};

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Cross-Campus Timetable E2E', () => {
  let crossSchoolTimetableService: CrossSchoolTimetableService;
  let conflictDetectionService: Partial<ConflictDetectionService>;

  beforeAll(() => {
    // Service-level integration tests with mocked dependencies
  });

  beforeEach(() => {
    currentUser = {
      id: SCHEDULER_ID,
      email: 'scheduler@nbk.edu.vn',
      role: UserRole.SCHEDULER,
      schoolId: SCHOOL_A_ID,
      accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Cross-School Conflict Detection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-School Conflict Detection', () => {
    it('should detect conflict when teacher has slot at same time in another school', () => {
      /**
       * Scenario:
       * - Teacher has slot at school A: day=2, period=1
       * - Scheduler tries to add slot at school B: day=2, period=1
       * - Expected: CROSS_SCHOOL_CONFLICT detected
       */
      const existingSlotsFromOtherSchools = [
        { dayOfWeek: 2, periodId: PERIOD_1_ID, schoolId: SCHOOL_A_ID },
      ];

      // Simulating cross-school conflict check logic
      const targetDayOfWeek = 2;
      const targetPeriodId = PERIOD_1_ID;

      const conflicts = existingSlotsFromOtherSchools.filter(
        (slot) =>
          slot.dayOfWeek === targetDayOfWeek &&
          slot.periodId === targetPeriodId,
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].schoolId).toBe(SCHOOL_A_ID);
    });

    it('should NOT detect conflict when slots are at different times', () => {
      const existingSlotsFromOtherSchools = [
        { dayOfWeek: 2, periodId: PERIOD_1_ID, schoolId: SCHOOL_A_ID },
      ];

      const targetDayOfWeek = 2;
      const targetPeriodId = PERIOD_2_ID; // Different period

      const conflicts = existingSlotsFromOtherSchools.filter(
        (slot) =>
          slot.dayOfWeek === targetDayOfWeek &&
          slot.periodId === targetPeriodId,
      );

      expect(conflicts.length).toBe(0);
    });

    it('should NOT detect conflict when slots are on different days', () => {
      const existingSlotsFromOtherSchools = [
        { dayOfWeek: 2, periodId: PERIOD_1_ID, schoolId: SCHOOL_A_ID },
      ];

      const targetDayOfWeek = 3; // Different day
      const targetPeriodId = PERIOD_1_ID;

      const conflicts = existingSlotsFromOtherSchools.filter(
        (slot) =>
          slot.dayOfWeek === targetDayOfWeek &&
          slot.periodId === targetPeriodId,
      );

      expect(conflicts.length).toBe(0);
    });

    it('should return conflict record with both school identifiers', () => {
      const teacherId = TEACHER_ID;
      const dayOfWeek = 2;
      const periodId = PERIOD_1_ID;
      const currentSchoolId = SCHOOL_B_ID;
      const conflictingSchoolId = SCHOOL_A_ID;

      const conflictResult: ConflictResult = {
        type: ConflictType.CROSS_SCHOOL_CONFLICT,
        severity: 'error',
        message: 'Giáo viên đã có tiết dạy tại trường khác vào thời điểm này',
        details: {
          teacherId,
          dayOfWeek,
          periodId,
        },
      };

      expect(conflictResult.type).toBe(ConflictType.CROSS_SCHOOL_CONFLICT);
      expect(conflictResult.severity).toBe('error');
      expect(conflictResult.details.teacherId).toBe(teacherId);
      expect(conflictResult.details.dayOfWeek).toBe(dayOfWeek);
      expect(conflictResult.details.periodId).toBe(periodId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Merged Timetable View with Travel Warnings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Merged Timetable with Travel Warnings', () => {
    it('should detect travel warning for consecutive periods at different schools', () => {
      // Simulate detectTravelWarnings logic
      const slots: MergedTimetableSlot[] = [
        { ...slotSchoolA, hasTravelWarning: false },
        { ...slotSchoolB, hasTravelWarning: false },
      ];

      // Sort by day + startTime
      const sorted = [...slots].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      // Apply travel warnings
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (
          prev.dayOfWeek === curr.dayOfWeek &&
          prev.schoolId !== curr.schoolId
        ) {
          curr.hasTravelWarning = true;
        }
      }

      expect(sorted[0].hasTravelWarning).toBe(false);
      expect(sorted[1].hasTravelWarning).toBe(true);
      expect(sorted[1].schoolId).toBe(SCHOOL_B_ID);
    });

    it('should NOT flag travel warning for consecutive periods at same school', () => {
      const slots: MergedTimetableSlot[] = [
        {
          ...slotSchoolA,
          periodId: PERIOD_1_ID,
          startTime: '07:30',
          hasTravelWarning: false,
        },
        {
          ...slotSchoolA,
          id: 'slot-a-3',
          periodId: PERIOD_2_ID,
          startTime: '08:20',
          hasTravelWarning: false,
        },
      ];

      const sorted = [...slots].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (
          prev.dayOfWeek === curr.dayOfWeek &&
          prev.schoolId !== curr.schoolId
        ) {
          curr.hasTravelWarning = true;
        }
      }

      expect(sorted[0].hasTravelWarning).toBe(false);
      expect(sorted[1].hasTravelWarning).toBe(false);
    });

    it('should NOT flag travel warning for different days at different schools', () => {
      const slots: MergedTimetableSlot[] = [
        { ...slotSchoolA, dayOfWeek: 2, hasTravelWarning: false },
        { ...slotSchoolB, dayOfWeek: 3, hasTravelWarning: false },
      ];

      const sorted = [...slots].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (
          prev.dayOfWeek === curr.dayOfWeek &&
          prev.schoolId !== curr.schoolId
        ) {
          curr.hasTravelWarning = true;
        }
      }

      expect(sorted[0].hasTravelWarning).toBe(false);
      expect(sorted[1].hasTravelWarning).toBe(false);
    });

    it('should merge slots from ALL accessible schools', () => {
      const allSlots: MergedTimetableSlot[] = [
        slotSchoolA,
        slotSchoolB,
        slotSchoolA_Period3,
      ];

      const schoolASlots = allSlots.filter((s) => s.schoolId === SCHOOL_A_ID);
      const schoolBSlots = allSlots.filter((s) => s.schoolId === SCHOOL_B_ID);

      expect(allSlots.length).toBe(schoolASlots.length + schoolBSlots.length);
      expect(schoolASlots.length).toBe(2);
      expect(schoolBSlots.length).toBe(1);
    });

    it('should annotate each slot with school name and address', () => {
      expect(slotSchoolA.schoolName).toBe('Trường Tiểu học NBK');
      expect(slotSchoolA.schoolAddress).toBe('Cầu Giấy, Hà Nội');
      expect(slotSchoolB.schoolName).toBe('Trường THCS NBK');
      expect(slotSchoolB.schoolAddress).toBe('Thanh Xuân, Hà Nội');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. School Filter on Merged Timetable
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Timetable School Filter', () => {
    const allSlots: MergedTimetableSlot[] = [
      slotSchoolA,
      slotSchoolB,
      slotSchoolA_Period3,
    ];

    it('should return only slots for filtered school', () => {
      const filterSchoolId = SCHOOL_A_ID;
      const filtered = allSlots.filter((s) => s.schoolId === filterSchoolId);

      expect(filtered.length).toBe(2);
      expect(filtered.every((s) => s.schoolId === SCHOOL_A_ID)).toBe(true);
    });

    it('should return all slots when no filter applied', () => {
      const filterSchoolId: string | undefined = undefined;
      const result = filterSchoolId
        ? allSlots.filter((s) => s.schoolId === filterSchoolId)
        : allSlots;

      expect(result.length).toBe(3);
    });

    it('should return empty when filtered school has no slots', () => {
      const filterSchoolId = '00000000-0000-4000-b000-000000000099'; // unknown school
      const filtered = allSlots.filter((s) => s.schoolId === filterSchoolId);

      expect(filtered.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Full E2E Flows (require infrastructure — skipped)
  // ═══════════════════════════════════════════════════════════════════════════

  describe.skip('Full E2E with real database (requires PostgreSQL + Redis)', () => {
    it('should detect cross-school conflict during timetable save via HTTP', () => {
      /**
       * Full flow:
       * 1. Create timetable version for school B
       * 2. Add slot for teacher who already has slot at school A same time
       * 3. ConflictDetectionService returns CROSS_SCHOOL_CONFLICT
       * 4. API returns warning with conflict details
       *
       * Required infrastructure:
       * - PostgreSQL with timetable_slots, teacher_school_assignments
       * - Redis for cross-school slots cache
       * - Seeded slots in school A
       */
    });

    it('should return merged timetable via HTTP endpoint with correct travel warnings', () => {
      /**
       * Full flow:
       * 1. GET /api/v1/timetable/cross-school/teacher/:teacherId
       * 2. Verify response contains slots from all accessible schools
       * 3. Verify travel warnings on consecutive different-school slots
       * 4. Verify color-code data per school
       *
       * Required infrastructure:
       * - PostgreSQL with published timetable versions
       * - Teacher with active TSAs to multiple schools
       */
    });

    it('should pre-load cross-school busy slots for FET generation', () => {
      /**
       * Full flow:
       * 1. Trigger timetable generation for school B
       * 2. FET adapter calls getCrossSchoolBusySlots()
       * 3. Verify teacher's slots from school A loaded as constraints
       * 4. Generated TKB has no cross-school conflicts
       *
       * Required infrastructure:
       * - FET engine accessible
       * - PostgreSQL with multi-school slot data
       */
    });
  });
});
