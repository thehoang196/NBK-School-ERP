import { TeacherTravelTimeChecker } from './teacher-travel-time.checker';
import { ConflictIndexes } from '../../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';
import { TimetableSlotEntity } from '../../entities/timetable-slot.entity';

describe('TeacherTravelTimeChecker', () => {
  let checker: TeacherTravelTimeChecker;

  beforeEach(() => {
    checker = new TeacherTravelTimeChecker();
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
      periodId: 'period-2',
      teacherId: 'teacher-1',
      classId: 'class-1',
      roomId: 'room-A',
      subjectId: 'subject-1',
      ...overrides,
    };
  }

  function buildSlotEntity(
    overrides: Partial<TimetableSlotEntity> = {},
  ): TimetableSlotEntity {
    const entity = new TimetableSlotEntity();
    entity.id = 'existing-slot-1';
    entity.schoolId = 'school-1';
    entity.versionId = 'version-1';
    entity.dayOfWeek = 2;
    entity.periodId = 'period-1';
    entity.classId = 'class-1';
    entity.teacherId = 'teacher-1';
    entity.subjectId = 'subject-1';
    entity.roomId = 'room-B';
    entity.isDoublePeriod = false;
    Object.assign(entity, overrides);
    return entity;
  }

  it('should return WARNING when adjacent periods are on different campuses', () => {
    const adjacentSlot = buildSlotEntity({
      periodId: 'period-1',
      roomId: 'room-B',
    } as any);
    const teacherDaySlots = new Map([['teacher-1-2', [adjacentSlot]]]);
    const periodOrderMap = new Map([
      ['period-1', 1],
      ['period-2', 2],
    ]);
    const roomCampusMap = new Map([
      ['room-A', 'campus-A'],
      ['room-B', 'campus-B'],
    ]);
    const indexes = buildIndexes({
      teacherDaySlots,
      periodOrderMap,
      roomCampusMap,
    });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(
      ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME,
    );
    expect(conflicts[0].severity).toBe(ConflictSeverity.WARNING);
    expect(conflicts[0].message).toBe(
      'Giáo viên không đủ thời gian di chuyển giữa hai cơ sở',
    );
    expect(conflicts[0].details.campusFrom).toBe('campus-B');
    expect(conflicts[0].details.campusTo).toBe('campus-A');
    expect(conflicts[0].details.teacherId).toBe('teacher-1');
    expect(conflicts[0].details.dayOfWeek).toBe(2);
    expect(conflicts[0].details.periodId).toBe('period-2');
  });

  it('should return empty array when adjacent periods are on the same campus', () => {
    const adjacentSlot = buildSlotEntity({
      periodId: 'period-1',
      roomId: 'room-B',
    } as any);
    const teacherDaySlots = new Map([['teacher-1-2', [adjacentSlot]]]);
    const periodOrderMap = new Map([
      ['period-1', 1],
      ['period-2', 2],
    ]);
    const roomCampusMap = new Map([
      ['room-A', 'campus-A'],
      ['room-B', 'campus-A'], // Same campus
    ]);
    const indexes = buildIndexes({
      teacherDaySlots,
      periodOrderMap,
      roomCampusMap,
    });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when target roomId is null', () => {
    const indexes = buildIndexes();
    const target = buildTarget({ roomId: null });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when target room has no campus mapping', () => {
    const periodOrderMap = new Map([['period-2', 2]]);
    const indexes = buildIndexes({ periodOrderMap });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when target periodId is not in periodOrderMap', () => {
    const indexes = buildIndexes();
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should exclude self via excludeSlotId', () => {
    const adjacentSlot = buildSlotEntity({
      id: 'self-slot',
      periodId: 'period-1',
      roomId: 'room-B',
    } as any);
    const teacherDaySlots = new Map([['teacher-1-2', [adjacentSlot]]]);
    const periodOrderMap = new Map([
      ['period-1', 1],
      ['period-2', 2],
    ]);
    const roomCampusMap = new Map([
      ['room-A', 'campus-A'],
      ['room-B', 'campus-B'],
    ]);
    const indexes = buildIndexes({
      teacherDaySlots,
      periodOrderMap,
      roomCampusMap,
    });
    const target = buildTarget({ excludeSlotId: 'self-slot' });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should not flag non-adjacent periods', () => {
    const nonAdjacentSlot = buildSlotEntity({
      periodId: 'period-4',
      roomId: 'room-B',
    } as any);
    const teacherDaySlots = new Map([['teacher-1-2', [nonAdjacentSlot]]]);
    const periodOrderMap = new Map([
      ['period-2', 2],
      ['period-4', 4],
    ]);
    const roomCampusMap = new Map([
      ['room-A', 'campus-A'],
      ['room-B', 'campus-B'],
    ]);
    const indexes = buildIndexes({
      teacherDaySlots,
      periodOrderMap,
      roomCampusMap,
    });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should skip adjacent slot when its roomId is null', () => {
    const adjacentSlot = buildSlotEntity({
      periodId: 'period-1',
      roomId: null,
    } as any);
    const teacherDaySlots = new Map([['teacher-1-2', [adjacentSlot]]]);
    const periodOrderMap = new Map([
      ['period-1', 1],
      ['period-2', 2],
    ]);
    const roomCampusMap = new Map([['room-A', 'campus-A']]);
    const indexes = buildIndexes({
      teacherDaySlots,
      periodOrderMap,
      roomCampusMap,
    });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });
});
