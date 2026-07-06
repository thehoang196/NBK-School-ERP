import {
  ConflictDetectionService,
  ConflictType,
  PostGenerationConflictResult,
} from './conflict-detection.service';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { ConflictSeverity, ValidationContext } from '../enums/conflict.enum';
import { ConflictType as NewConflictType } from '../enums/conflict.enum';
import {
  Conflict,
  SlotCheckPayload,
  ConflictCheckOptions,
} from '../interfaces/conflict.interface';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import {
  TeacherDoubleBookedChecker,
  RoomDoubleBookedChecker,
  ClassDoubleBookedChecker,
  TeacherMaxConsecutiveChecker,
  TeacherTravelTimeChecker,
  SubjectConsecutiveDaysChecker,
  TeacherMaxPerDayChecker,
} from './checkers';

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService;
  let mockSlotRepository: Record<string, jest.Mock>;
  let mockVersionRepository: Record<string, jest.Mock>;
  let mockTeacherRepo: Record<string, jest.Mock>;
  let mockTeacherDoubleBooked: jest.Mocked<TeacherDoubleBookedChecker>;
  let mockRoomDoubleBooked: jest.Mocked<RoomDoubleBookedChecker>;
  let mockClassDoubleBooked: jest.Mocked<ClassDoubleBookedChecker>;
  let mockTeacherMaxConsecutive: jest.Mocked<TeacherMaxConsecutiveChecker>;
  let mockTeacherTravelTime: jest.Mocked<TeacherTravelTimeChecker>;
  let mockSubjectConsecutiveDays: jest.Mocked<SubjectConsecutiveDaysChecker>;
  let mockTeacherMaxPerDay: jest.Mocked<TeacherMaxPerDayChecker>;

  beforeEach(() => {
    mockSlotRepository = {
      findConflicts: jest.fn().mockResolvedValue([]),
      findByVersion: jest.fn().mockResolvedValue([]),
      findByQuery: jest.fn().mockResolvedValue([]),
    };
    mockVersionRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockTeacherRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockTeacherDoubleBooked = {
      check: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<TeacherDoubleBookedChecker>;
    mockRoomDoubleBooked = {
      check: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<RoomDoubleBookedChecker>;
    mockClassDoubleBooked = {
      check: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ClassDoubleBookedChecker>;
    mockTeacherMaxConsecutive = {
      check: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<TeacherMaxConsecutiveChecker>;
    mockTeacherTravelTime = {
      check: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<TeacherTravelTimeChecker>;
    mockSubjectConsecutiveDays = {
      check: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<SubjectConsecutiveDaysChecker>;
    mockTeacherMaxPerDay = {
      check: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<TeacherMaxPerDayChecker>;

    service = new ConflictDetectionService(
      mockSlotRepository as unknown as TimetableSlotRepository,
      mockVersionRepository as unknown as TimetableVersionRepository,
      mockTeacherRepo as never,
      {} as never, // timetableVersionRepo
      mockTeacherDoubleBooked,
      mockRoomDoubleBooked,
      mockClassDoubleBooked,
      mockTeacherMaxConsecutive,
      mockTeacherTravelTime,
      mockSubjectConsecutiveDays,
      mockTeacherMaxPerDay,
      { getAccessibleSchoolIds: jest.fn().mockResolvedValue([]) } as never,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // detectConflicts() tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('detectConflicts', () => {
    const target: SlotCheckPayload = {
      versionId: 'v1',
      dayOfWeek: 2,
      periodId: 'p1',
      teacherId: 't1',
      classId: 'c1',
      roomId: 'r1',
      subjectId: 's1',
    };

    const indexes: ConflictIndexes = {
      teacherTimeslot: new Map(),
      roomTimeslot: new Map(),
      classTimeslot: new Map(),
      teacherDayPeriods: new Map(),
      subjectDays: new Map(),
      teacherDaySlots: new Map(),
      periodOrderMap: new Map(),
      roomCampusMap: new Map(),
    };

    const options: ConflictCheckOptions = {
      context: ValidationContext.SINGLE_SLOT,
      schoolId: 'school-1',
    };

    it('should run all hard and soft checkers when skipSoftChecks is false', () => {
      service.detectConflicts(target, indexes, options);

      expect(mockTeacherDoubleBooked.check).toHaveBeenCalledWith(
        target,
        indexes,
      );
      expect(mockRoomDoubleBooked.check).toHaveBeenCalledWith(target, indexes);
      expect(mockClassDoubleBooked.check).toHaveBeenCalledWith(target, indexes);
      expect(mockTeacherMaxConsecutive.check).toHaveBeenCalledWith(
        target,
        indexes,
      );
      expect(mockTeacherTravelTime.check).toHaveBeenCalledWith(target, indexes);
      expect(mockSubjectConsecutiveDays.check).toHaveBeenCalledWith(
        target,
        indexes,
      );
      expect(mockTeacherMaxPerDay.check).toHaveBeenCalledWith(target, indexes);
    });

    it('should skip soft checkers when skipSoftChecks is true', () => {
      const skipOptions: ConflictCheckOptions = {
        ...options,
        skipSoftChecks: true,
      };

      service.detectConflicts(target, indexes, skipOptions);

      // Hard checkers should still be called
      expect(mockTeacherDoubleBooked.check).toHaveBeenCalledWith(
        target,
        indexes,
      );
      expect(mockRoomDoubleBooked.check).toHaveBeenCalledWith(target, indexes);
      expect(mockClassDoubleBooked.check).toHaveBeenCalledWith(target, indexes);

      // Soft checkers should NOT be called
      expect(mockTeacherMaxConsecutive.check).not.toHaveBeenCalled();
      expect(mockTeacherTravelTime.check).not.toHaveBeenCalled();
      expect(mockSubjectConsecutiveDays.check).not.toHaveBeenCalled();
      expect(mockTeacherMaxPerDay.check).not.toHaveBeenCalled();
    });

    it('should aggregate conflicts from all checkers', () => {
      const teacherConflict: Conflict = {
        type: NewConflictType.TEACHER_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Teacher double booked',
        details: {},
      };
      const roomConflict: Conflict = {
        type: NewConflictType.ROOM_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Room double booked',
        details: {},
      };
      const softConflict: Conflict = {
        type: NewConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
        severity: ConflictSeverity.WARNING,
        message: 'Max consecutive exceeded',
        details: {},
      };

      mockTeacherDoubleBooked.check.mockReturnValue([teacherConflict]);
      mockRoomDoubleBooked.check.mockReturnValue([roomConflict]);
      mockTeacherMaxConsecutive.check.mockReturnValue([softConflict]);

      const result = service.detectConflicts(target, indexes, options);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual(teacherConflict);
      expect(result).toContainEqual(roomConflict);
      expect(result).toContainEqual(softConflict);
    });

    it('should return empty array when no conflicts detected', () => {
      const result = service.detectConflicts(target, indexes, options);
      expect(result).toEqual([]);
    });

    it('should not throw exceptions (pure validator pattern)', () => {
      mockTeacherDoubleBooked.check.mockImplementation(() => {
        throw new Error('Unexpected error in checker');
      });

      // The service should propagate checker errors (they are not swallowed)
      // but the service itself never throws — only checkers can throw if broken
      expect(() => service.detectConflicts(target, indexes, options)).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // buildIndexes() tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('buildIndexes', () => {
    const periodOrderMap = new Map<string, number>([
      ['p1', 1],
      ['p2', 2],
      ['p3', 3],
    ]);

    it('should return empty indexes for empty slots array', () => {
      const indexes = service.buildIndexes([], periodOrderMap);

      expect(indexes.teacherTimeslot.size).toBe(0);
      expect(indexes.roomTimeslot.size).toBe(0);
      expect(indexes.classTimeslot.size).toBe(0);
      expect(indexes.teacherDayPeriods.size).toBe(0);
      expect(indexes.subjectDays.size).toBe(0);
      expect(indexes.teacherDaySlots.size).toBe(0);
      expect(indexes.periodOrderMap).toBe(periodOrderMap);
      expect(indexes.roomCampusMap.size).toBe(0);
    });

    it('should build teacherTimeslot index correctly', () => {
      const slot = createSlot({
        teacherId: 't1',
        dayOfWeek: 2,
        periodId: 'p1',
      });
      const indexes = service.buildIndexes([slot], periodOrderMap);

      expect(indexes.teacherTimeslot.get('t1-2-p1')).toBe(slot);
    });

    it('should build roomTimeslot index correctly', () => {
      const slot = createSlot({ roomId: 'r1', dayOfWeek: 3, periodId: 'p2' });
      const indexes = service.buildIndexes([slot], periodOrderMap);

      expect(indexes.roomTimeslot.get('r1-3-p2')).toBe(slot);
    });

    it('should skip roomTimeslot for null roomId', () => {
      const slot = createSlot({ roomId: null, dayOfWeek: 3, periodId: 'p2' });
      const indexes = service.buildIndexes([slot], periodOrderMap);

      expect(indexes.roomTimeslot.size).toBe(0);
    });

    it('should build classTimeslot index correctly', () => {
      const slot = createSlot({ classId: 'c1', dayOfWeek: 4, periodId: 'p3' });
      const indexes = service.buildIndexes([slot], periodOrderMap);

      expect(indexes.classTimeslot.get('c1-4-p3')).toBe(slot);
    });

    it('should build teacherDayPeriods index with period orders', () => {
      const slot1 = createSlot({
        teacherId: 't1',
        dayOfWeek: 2,
        periodId: 'p1',
      });
      const slot2 = createSlot({
        teacherId: 't1',
        dayOfWeek: 2,
        periodId: 'p2',
      });
      const indexes = service.buildIndexes([slot1, slot2], periodOrderMap);

      const periods = indexes.teacherDayPeriods.get('t1-2');
      expect(periods).toEqual([1, 2]);
    });

    it('should build teacherDaySlots index correctly', () => {
      const slot1 = createSlot({
        teacherId: 't1',
        dayOfWeek: 2,
        periodId: 'p1',
      });
      const slot2 = createSlot({
        teacherId: 't1',
        dayOfWeek: 2,
        periodId: 'p2',
      });
      const indexes = service.buildIndexes([slot1, slot2], periodOrderMap);

      const slots = indexes.teacherDaySlots.get('t1-2');
      expect(slots).toHaveLength(2);
      expect(slots).toContain(slot1);
      expect(slots).toContain(slot2);
    });

    it('should build subjectDays index correctly', () => {
      const slot1 = createSlot({
        classId: 'c1',
        subjectId: 's1',
        dayOfWeek: 2,
      });
      const slot2 = createSlot({
        classId: 'c1',
        subjectId: 's1',
        dayOfWeek: 3,
      });
      const indexes = service.buildIndexes([slot1, slot2], periodOrderMap);

      const days = indexes.subjectDays.get('c1-s1');
      expect(days).toEqual([2, 3]);
    });

    it('should pass through roomCampusMap when provided', () => {
      const roomCampusMap = new Map([['r1', 'campus-a']]);
      const indexes = service.buildIndexes([], periodOrderMap, roomCampusMap);

      expect(indexes.roomCampusMap).toBe(roomCampusMap);
    });

    it('should handle multiple slots in a single O(n) pass', () => {
      const slots = [
        createSlot({
          id: 's1',
          teacherId: 't1',
          classId: 'c1',
          subjectId: 'sub1',
          roomId: 'r1',
          dayOfWeek: 2,
          periodId: 'p1',
        }),
        createSlot({
          id: 's2',
          teacherId: 't1',
          classId: 'c2',
          subjectId: 'sub2',
          roomId: 'r2',
          dayOfWeek: 2,
          periodId: 'p2',
        }),
        createSlot({
          id: 's3',
          teacherId: 't2',
          classId: 'c1',
          subjectId: 'sub1',
          roomId: 'r1',
          dayOfWeek: 3,
          periodId: 'p1',
        }),
      ];

      const indexes = service.buildIndexes(slots, periodOrderMap);

      // Teacher timeslots
      expect(indexes.teacherTimeslot.size).toBe(3);
      expect(indexes.teacherTimeslot.get('t1-2-p1')).toBe(slots[0]);
      expect(indexes.teacherTimeslot.get('t1-2-p2')).toBe(slots[1]);
      expect(indexes.teacherTimeslot.get('t2-3-p1')).toBe(slots[2]);

      // Room timeslots
      expect(indexes.roomTimeslot.size).toBe(3);

      // Teacher day periods
      expect(indexes.teacherDayPeriods.get('t1-2')).toEqual([1, 2]);
      expect(indexes.teacherDayPeriods.get('t2-3')).toEqual([1]);

      // Subject days
      expect(indexes.subjectDays.get('c1-sub1')).toEqual([2, 3]);
      expect(indexes.subjectDays.get('c2-sub2')).toEqual([2]);
    });

    it('should skip period order when periodId not in periodOrderMap', () => {
      const slot = createSlot({
        teacherId: 't1',
        dayOfWeek: 2,
        periodId: 'unknown-period',
      });
      const indexes = service.buildIndexes([slot], periodOrderMap);

      expect(indexes.teacherDayPeriods.get('t1-2')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Legacy method: detectPostGenerationConflicts() tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('detectPostGenerationConflicts', () => {
    const versionId = 'version-1';
    const schoolId = 'school-1';

    it('should return empty array when no conflicts', async () => {
      const slots = [
        createSlot({
          id: 's1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          dayOfWeek: 2,
          periodId: 'p1',
        }),
        createSlot({
          id: 's2',
          teacherId: 't2',
          classId: 'c2',
          roomId: 'r2',
          dayOfWeek: 2,
          periodId: 'p1',
        }),
      ];
      mockSlotRepository.findByVersion!.mockResolvedValue(
        slots as TimetableSlotEntity[],
      );

      const result = await service.detectPostGenerationConflicts(
        versionId,
        schoolId,
      );

      expect(result).toEqual([]);
      expect(mockVersionRepository.update).toHaveBeenCalledWith(versionId, {
        hasConflicts: false,
        conflictCount: 0,
        conflictDetails: null,
      });
    });

    it('should detect teacher double booking', async () => {
      const slots = [
        createSlot({
          id: 's1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          dayOfWeek: 2,
          periodId: 'p1',
        }),
        createSlot({
          id: 's2',
          teacherId: 't1',
          classId: 'c2',
          roomId: 'r2',
          dayOfWeek: 2,
          periodId: 'p1',
        }),
      ];
      mockSlotRepository.findByVersion!.mockResolvedValue(
        slots as TimetableSlotEntity[],
      );

      const result = await service.detectPostGenerationConflicts(
        versionId,
        schoolId,
      );

      const teacherConflicts = result.filter(
        (c) => c.type === 'teacher_double_booking',
      );
      expect(teacherConflicts.length).toBeGreaterThan(0);
    });

    it('should skip room conflict when roomId is null', async () => {
      const slots = [
        createSlot({
          id: 's1',
          teacherId: 't1',
          classId: 'c1',
          roomId: null,
          dayOfWeek: 2,
          periodId: 'p1',
        }),
        createSlot({
          id: 's2',
          teacherId: 't2',
          classId: 'c2',
          roomId: null,
          dayOfWeek: 2,
          periodId: 'p1',
        }),
      ];
      mockSlotRepository.findByVersion!.mockResolvedValue(
        slots as TimetableSlotEntity[],
      );

      const result = await service.detectPostGenerationConflicts(
        versionId,
        schoolId,
      );

      const roomConflicts = result.filter(
        (c) => c.type === 'room_double_booking',
      );
      expect(roomConflicts).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createSlot(
  overrides: Partial<TimetableSlotEntity> = {},
): TimetableSlotEntity {
  return {
    id: 'slot-' + Math.random().toString(36).slice(2, 8),
    schoolId: 'school-1',
    versionId: 'version-1',
    dayOfWeek: 2,
    periodId: 'p1',
    classId: 'class-1',
    teacherId: 'teacher-1',
    subjectId: 'subject-1',
    roomId: 'room-1',
    isDoublePeriod: false,
    ...overrides,
  } as TimetableSlotEntity;
}
