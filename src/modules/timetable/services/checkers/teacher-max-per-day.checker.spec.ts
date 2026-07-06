import { TeacherMaxPerDayChecker } from './teacher-max-per-day.checker';
import { ConflictIndexes } from '../../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';

describe('TeacherMaxPerDayChecker', () => {
  let checker: TeacherMaxPerDayChecker;

  beforeEach(() => {
    checker = new TeacherMaxPerDayChecker();
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
      periodId: 'period-9',
      teacherId: 'teacher-1',
      classId: 'class-1',
      roomId: 'room-1',
      subjectId: 'subject-1',
      ...overrides,
    };
  }

  it('should return WARNING when total periods exceed max (8)', () => {
    // Teacher already has 8 periods — adding 1 more = 9 > 8
    const teacherDayPeriods = new Map([
      ['teacher-1-2', [1, 2, 3, 4, 5, 6, 7, 8]],
    ]);
    const indexes = buildIndexes({ teacherDayPeriods });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(
      ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED,
    );
    expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
    expect(conflicts[0].message).toBe(
      'Giáo viên vượt quá số tiết tối đa trong ngày',
    );
    expect(conflicts[0].details.currentCount).toBe(9);
    expect(conflicts[0].details.maxAllowed).toBe(8);
    expect(conflicts[0].details.teacherId).toBe('teacher-1');
    expect(conflicts[0].details.dayOfWeek).toBe(2);
  });

  it('should return empty array when at exactly max periods (8)', () => {
    // Teacher has 7 periods — adding 1 = 8 = exactly at limit, not exceeding
    const teacherDayPeriods = new Map([['teacher-1-2', [1, 2, 3, 4, 5, 6, 7]]]);
    const indexes = buildIndexes({ teacherDayPeriods });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when no existing periods for teacher on that day', () => {
    const indexes = buildIndexes();
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should count correctly with few existing periods', () => {
    // Teacher has 3 periods — adding 1 = 4, well within limit
    const teacherDayPeriods = new Map([['teacher-1-2', [1, 2, 3]]]);
    const indexes = buildIndexes({ teacherDayPeriods });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });
});
