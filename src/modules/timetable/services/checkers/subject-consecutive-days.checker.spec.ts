import { SubjectConsecutiveDaysChecker } from './subject-consecutive-days.checker';
import { ConflictIndexes } from '../../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';

describe('SubjectConsecutiveDaysChecker', () => {
  let checker: SubjectConsecutiveDaysChecker;

  beforeEach(() => {
    checker = new SubjectConsecutiveDaysChecker();
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
      dayOfWeek: 3,
      periodId: 'period-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      roomId: 'room-1',
      subjectId: 'subject-1',
      ...overrides,
    };
  }

  it('should return WARNING when subject is on an adjacent day', () => {
    // Subject appears on day 2, target is day 3 → adjacent
    const subjectDays = new Map([['class-1-subject-1', [2]]]);
    const indexes = buildIndexes({ subjectDays });
    const target = buildTarget({ dayOfWeek: 3 });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.SUBJECT_CONSECUTIVE_DAYS);
    expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
    expect(conflicts[0].message).toBe(
      'Môn học được xếp vào các ngày liên tiếp cho cùng lớp',
    );
    expect(conflicts[0].details.affectedDays).toEqual([2, 3]);
    expect(conflicts[0].details.classId).toBe('class-1');
    expect(conflicts[0].details.subjectId).toBe('subject-1');
    expect(conflicts[0].details.dayOfWeek).toBe(3);
  });

  it('should return WARNING when target day is before an existing day', () => {
    // Subject appears on day 5, target is day 4 → adjacent
    const subjectDays = new Map([['class-1-subject-1', [5]]]);
    const indexes = buildIndexes({ subjectDays });
    const target = buildTarget({ dayOfWeek: 4 });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].details.affectedDays).toEqual([4, 5]);
  });

  it('should return empty array when subject is on non-adjacent days', () => {
    // Subject appears on day 2, target is day 5 → not adjacent
    const subjectDays = new Map([['class-1-subject-1', [2]]]);
    const indexes = buildIndexes({ subjectDays });
    const target = buildTarget({ dayOfWeek: 5 });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when no existing days for subject-class', () => {
    const indexes = buildIndexes();
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should detect adjacency among multiple existing days', () => {
    // Subject on days [2, 5], target is day 6 → adjacent to 5
    const subjectDays = new Map([['class-1-subject-1', [2, 5]]]);
    const indexes = buildIndexes({ subjectDays });
    const target = buildTarget({ dayOfWeek: 6 });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].details.affectedDays).toEqual([2, 5, 6]);
  });

  it('should handle boundary days correctly (day 2 and day 7)', () => {
    // Day 7 (Saturday) and day 2 (Monday) — difference is 5, not adjacent
    const subjectDays = new Map([['class-1-subject-1', [7]]]);
    const indexes = buildIndexes({ subjectDays });
    const target = buildTarget({ dayOfWeek: 2 });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });
});
