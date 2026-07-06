import { ClassDoubleBookedChecker } from './class-double-booked.checker';
import { ConflictIndexes } from '../../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';
import { TimetableSlotEntity } from '../../entities/timetable-slot.entity';

describe('ClassDoubleBookedChecker', () => {
  let checker: ClassDoubleBookedChecker;

  beforeEach(() => {
    checker = new ClassDoubleBookedChecker();
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
      dayOfWeek: 4,
      periodId: 'period-3',
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
    entity.id = 'existing-slot-3';
    entity.schoolId = 'school-1';
    entity.versionId = 'version-1';
    entity.dayOfWeek = 4;
    entity.periodId = 'period-3';
    entity.classId = 'class-1';
    entity.teacherId = 'teacher-3';
    entity.subjectId = 'subject-3';
    entity.roomId = 'room-3';
    entity.isDoublePeriod = false;
    (entity as any).class = { name: 'Lớp 12C3' };
    (entity as any).teacher = { fullName: 'Lê Văn C' };
    (entity as any).subject = { name: 'Hóa' };
    Object.assign(entity, overrides);
    return entity;
  }

  it('should return a CLASS_DOUBLE_BOOKED conflict when class is already booked', () => {
    const existingSlot = buildSlotEntity();
    const classTimeslot = new Map([['class-1-4-period-3', existingSlot]]);
    const indexes = buildIndexes({ classTimeslot });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.CLASS_DOUBLE_BOOKED);
    expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
    expect(conflicts[0].message).toBe(
      'Lớp học đã có môn học khác tại tiết này',
    );
    expect(conflicts[0].details.conflictingSlotId).toBe('existing-slot-3');
    expect(conflicts[0].details.subjectName).toBe('Hóa');
    expect(conflicts[0].details.teacherName).toBe('Lê Văn C');
  });

  it('should return empty array when no existing slot at that class timeslot', () => {
    const indexes = buildIndexes();
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should exclude self via excludeSlotId (update operation)', () => {
    const existingSlot = buildSlotEntity({ id: 'slot-being-updated' } as any);
    const classTimeslot = new Map([['class-1-4-period-3', existingSlot]]);
    const indexes = buildIndexes({ classTimeslot });
    const target = buildTarget({ excludeSlotId: 'slot-being-updated' });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should handle missing subject/teacher relations gracefully', () => {
    const existingSlot = buildSlotEntity();
    (existingSlot as any).subject = undefined;
    (existingSlot as any).teacher = undefined;
    const classTimeslot = new Map([['class-1-4-period-3', existingSlot]]);
    const indexes = buildIndexes({ classTimeslot });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].details.subjectName).toBe('');
    expect(conflicts[0].details.teacherName).toBe('');
  });
});
