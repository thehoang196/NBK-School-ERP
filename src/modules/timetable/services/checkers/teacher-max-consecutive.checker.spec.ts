import { TeacherMaxConsecutiveChecker } from './teacher-max-consecutive.checker';
import { ConflictIndexes } from '../../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';

describe('TeacherMaxConsecutiveChecker', () => {
  let checker: TeacherMaxConsecutiveChecker;

  beforeEach(() => {
    checker = new TeacherMaxConsecutiveChecker();
  });

  function buildIndexes(
    overrides: Partial<ConflictIndexes> = {},
  ): ConflictIndexes {
    return {
      teacherTimeslot: new Map(),
      roomTimeslot: new Map(),
      classTimeslot: new Map(),
      teacherDayPeriods: new Map(),
      subjectDays: new Map(),
      teacherDaySlots: new Map(),
      periodOrderMap: new Map(),
      roomCampusMap: new Map(),
      ...overrides,
    };
  }

  function buildTarget(
    overrides: Partial<SlotCheckPayload> = {},
  ): SlotCheckPayload {
    return {
      versionId: 'version-1',
      dayOfWeek: 2,
      periodId: 'period-5',
      teacherId: 'teacher-1',
      classId: 'class-1',
      roomId: 'room-1',
      subjectId: 'subject-1',
      ...overrides,
    };
  }

  it('should return WARNING when consecutive periods exceed 4', () => {
    // Teacher already has periods 1,2,3,4 — adding period 5 makes 5 consecutive
    const teacherDayPeriods = new Map([['teacher-1-2', [1, 2, 3, 4]]]);
    const periodOrderMap = new Map([['period-5', 5]]);
    const indexes = buildIndexes({ teacherDayPeriods, periodOrderMap });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(
      ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
    );
    expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
    expect(conflicts[0].message).toBe(
      'Giáo viên dạy quá 4 tiết liên tiếp trong ngày',
    );
    expect(conflicts[0].details.currentCount).toBe(5);
    expect(conflicts[0].details.maxAllowed).toBe(4);
    expect(conflicts[0].details.teacherId).toBe('teacher-1');
    expect(conflicts[0].details.dayOfWeek).toBe(2);
  });

  it('should return empty array when at exactly 4 consecutive (the limit)', () => {
    // Teacher has periods 1,2,3 — adding period 4 makes exactly 4 consecutive (not exceeding)
    const teacherDayPeriods = new Map([['teacher-1-2', [1, 2, 3]]]);
    const periodOrderMap = new Map([['period-5', 4]]);
    const indexes = buildIndexes({ teacherDayPeriods, periodOrderMap });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when there is a gap in periods', () => {
    // Teacher has periods 1,2,4,5 — adding period 6 = sequence [1,2,4,5,6]
    // Longest consecutive is 3 (4,5,6) — no violation
    const teacherDayPeriods = new Map([['teacher-1-2', [1, 2, 4, 5]]]);
    const periodOrderMap = new Map([['period-5', 6]]);
    const indexes = buildIndexes({ teacherDayPeriods, periodOrderMap });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when no existing periods for the teacher on that day', () => {
    const periodOrderMap = new Map([['period-5', 1]]);
    const indexes = buildIndexes({ periodOrderMap });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when periodOrderMap does not have the target period', () => {
    const teacherDayPeriods = new Map([['teacher-1-2', [1, 2, 3, 4]]]);
    const indexes = buildIndexes({ teacherDayPeriods });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should detect consecutive correctly when target fills a gap creating long sequence', () => {
    // Teacher has periods 1,2,4,5,6 — adding period 3 makes [1,2,3,4,5,6] = 6 consecutive
    const teacherDayPeriods = new Map([['teacher-1-2', [1, 2, 4, 5, 6]]]);
    const periodOrderMap = new Map([['period-5', 3]]);
    const indexes = buildIndexes({ teacherDayPeriods, periodOrderMap });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].details.currentCount).toBe(6);
  });
});
