import { RoomDoubleBookedChecker } from './room-double-booked.checker';
import { ConflictIndexes } from '../../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';
import { TimetableSlotEntity } from '../../entities/timetable-slot.entity';

describe('RoomDoubleBookedChecker', () => {
  let checker: RoomDoubleBookedChecker;

  beforeEach(() => {
    checker = new RoomDoubleBookedChecker();
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
      periodId: 'period-2',
      teacherId: 'teacher-1',
      classId: 'class-1',
      roomId: 'room-1',
      subjectId: 'subject-1',
      ...overrides,
    };
  }

  function buildSlotEntity(
    overrides: Partial<TimetableSlotEntity> = {},
  ): TimetableSlotEntity {
    const entity = new TimetableSlotEntity();
    entity.id = 'existing-slot-2';
    entity.schoolId = 'school-1';
    entity.versionId = 'version-1';
    entity.dayOfWeek = 3;
    entity.periodId = 'period-2';
    entity.classId = 'class-2';
    entity.teacherId = 'teacher-2';
    entity.subjectId = 'subject-2';
    entity.roomId = 'room-1';
    entity.isDoublePeriod = false;
    (entity as any).class = { name: 'Lớp 11B2' };
    (entity as any).teacher = { fullName: 'Trần Thị B' };
    (entity as any).subject = { name: 'Lý' };
    Object.assign(entity, overrides);
    return entity;
  }

  it('should return a ROOM_DOUBLE_BOOKED conflict when room is already booked', () => {
    const existingSlot = buildSlotEntity();
    const roomTimeslot = new Map([['room-1-3-period-2', existingSlot]]);
    const indexes = buildIndexes({ roomTimeslot });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.ROOM_DOUBLE_BOOKED);
    expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
    expect(conflicts[0].message).toBe('Phòng học đã được sử dụng tại tiết này');
    expect(conflicts[0].details.conflictingSlotId).toBe('existing-slot-2');
    expect(conflicts[0].details.className).toBe('Lớp 11B2');
    expect(conflicts[0].details.teacherName).toBe('Trần Thị B');
  });

  it('should skip check and return empty when roomId is null', () => {
    const existingSlot = buildSlotEntity();
    const roomTimeslot = new Map([['room-1-3-period-2', existingSlot]]);
    const indexes = buildIndexes({ roomTimeslot });
    const target = buildTarget({ roomId: null });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return empty array when no existing slot at that room timeslot', () => {
    const indexes = buildIndexes();
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should exclude self via excludeSlotId (update operation)', () => {
    const existingSlot = buildSlotEntity({ id: 'slot-being-updated' } as any);
    const roomTimeslot = new Map([['room-1-3-period-2', existingSlot]]);
    const indexes = buildIndexes({ roomTimeslot });
    const target = buildTarget({ excludeSlotId: 'slot-being-updated' });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should handle missing class/teacher relations gracefully', () => {
    const existingSlot = buildSlotEntity();
    (existingSlot as any).class = undefined;
    (existingSlot as any).teacher = undefined;
    const roomTimeslot = new Map([['room-1-3-period-2', existingSlot]]);
    const indexes = buildIndexes({ roomTimeslot });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].details.className).toBe('');
    expect(conflicts[0].details.teacherName).toBe('');
  });
});
