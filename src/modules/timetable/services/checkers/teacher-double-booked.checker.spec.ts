import { TeacherDoubleBookedChecker } from './teacher-double-booked.checker';
import { ConflictIndexes } from '../../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../../interfaces/conflict.interface';
import { ConflictType, ConflictSeverity } from '../../enums/conflict.enum';
import { TimetableSlotEntity } from '../../entities/timetable-slot.entity';

describe('TeacherDoubleBookedChecker', () => {
  let checker: TeacherDoubleBookedChecker;

  beforeEach(() => {
    checker = new TeacherDoubleBookedChecker();
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
      periodId: 'period-1',
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
    entity.id = 'existing-slot-1';
    entity.schoolId = 'school-1';
    entity.versionId = 'version-1';
    entity.dayOfWeek = 2;
    entity.periodId = 'period-1';
    entity.classId = 'class-2';
    entity.teacherId = 'teacher-1';
    entity.subjectId = 'subject-2';
    entity.roomId = 'room-2';
    entity.isDoublePeriod = false;
    (entity as any).class = { name: 'Lớp 10A1' };
    (entity as any).subject = { name: 'Toán' };
    (entity as any).teacher = { fullName: 'Nguyễn Văn A' };
    Object.assign(entity, overrides);
    return entity;
  }

  it('should return a TEACHER_DOUBLE_BOOKED conflict when teacher is already booked', () => {
    const existingSlot = buildSlotEntity();
    const teacherTimeslot = new Map([['teacher-1-2-period-1', existingSlot]]);
    const indexes = buildIndexes({ teacherTimeslot });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.TEACHER_DOUBLE_BOOKED);
    expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
    expect(conflicts[0].message).toBe('Giáo viên đã có lịch dạy tại tiết này');
    expect(conflicts[0].details.conflictingSlotId).toBe('existing-slot-1');
    expect(conflicts[0].details.className).toBe('Lớp 10A1');
    expect(conflicts[0].details.subjectName).toBe('Toán');
  });

  it('should return empty array when no existing slot at that timeslot', () => {
    const indexes = buildIndexes();
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should exclude self via excludeSlotId (update operation)', () => {
    const existingSlot = buildSlotEntity({ id: 'slot-being-updated' } as any);
    const teacherTimeslot = new Map([['teacher-1-2-period-1', existingSlot]]);
    const indexes = buildIndexes({ teacherTimeslot });
    const target = buildTarget({ excludeSlotId: 'slot-being-updated' });

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(0);
  });

  it('should handle missing class/subject relations gracefully', () => {
    const existingSlot = buildSlotEntity();
    (existingSlot as any).class = undefined;
    (existingSlot as any).subject = undefined;
    const teacherTimeslot = new Map([['teacher-1-2-period-1', existingSlot]]);
    const indexes = buildIndexes({ teacherTimeslot });
    const target = buildTarget();

    const conflicts = checker.check(target, indexes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].details.className).toBe('');
    expect(conflicts[0].details.subjectName).toBe('');
  });
});
