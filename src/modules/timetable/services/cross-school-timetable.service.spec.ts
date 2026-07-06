import {
  CrossSchoolTimetableService,
  MergedTimetableSlot,
} from './cross-school-timetable.service';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { DataSource } from 'typeorm';

describe('CrossSchoolTimetableService', () => {
  let service: CrossSchoolTimetableService;
  let mockGetAccessibleSchoolIds: jest.Mock;
  let mockDataSource: Partial<DataSource>;
  let mockVersionRepo: { find: jest.Mock };
  let mockSlotQueryBuilder: Record<string, jest.Mock>;

  const teacherId = 'teacher-001';
  const semesterId = 'semester-001';
  const schoolAId = 'school-a';
  const schoolBId = 'school-b';

  beforeEach(() => {
    mockGetAccessibleSchoolIds = jest.fn();

    const mockTeacherSchoolAssignmentService = {
      getAccessibleSchoolIds: mockGetAccessibleSchoolIds,
    };

    mockSlotQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn(),
    };

    mockVersionRepo = {
      find: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        const entityName = typeof entity === 'function' ? entity.name : '';
        if (entityName.includes('Version')) {
          return mockVersionRepo;
        }
        return {
          createQueryBuilder: jest.fn().mockReturnValue(mockSlotQueryBuilder),
        };
      }),
      query: jest.fn(),
    };

    service = new CrossSchoolTimetableService(
      mockTeacherSchoolAssignmentService as unknown as TeacherSchoolAssignmentService,
      mockDataSource as unknown as DataSource,
    );
  });

  describe('detectTravelWarnings', () => {
    it('should return empty array for empty input', () => {
      const result = service.detectTravelWarnings([]);
      expect(result).toEqual([]);
    });

    it('should not set warning for single slot', () => {
      const slots: MergedTimetableSlot[] = [
        createSlot({ dayOfWeek: 2, startTime: '07:30', schoolId: schoolAId }),
      ];

      const result = service.detectTravelWarnings(slots);
      expect(result).toHaveLength(1);
      expect(result[0].hasTravelWarning).toBe(false);
    });

    it('should not set warning for consecutive slots at same school', () => {
      const slots: MergedTimetableSlot[] = [
        createSlot({ dayOfWeek: 2, startTime: '07:30', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 2, startTime: '08:15', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 2, startTime: '09:00', schoolId: schoolAId }),
      ];

      const result = service.detectTravelWarnings(slots);
      expect(result.every((s) => s.hasTravelWarning === false)).toBe(true);
    });

    it('should set warning when consecutive slots are at different schools on same day', () => {
      const slots: MergedTimetableSlot[] = [
        createSlot({ dayOfWeek: 2, startTime: '07:30', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 2, startTime: '08:15', schoolId: schoolBId }),
      ];

      const result = service.detectTravelWarnings(slots);
      expect(result[0].hasTravelWarning).toBe(false);
      expect(result[1].hasTravelWarning).toBe(true);
    });

    it('should not set warning for slots at different schools on different days', () => {
      const slots: MergedTimetableSlot[] = [
        createSlot({ dayOfWeek: 2, startTime: '07:30', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 3, startTime: '07:30', schoolId: schoolBId }),
      ];

      const result = service.detectTravelWarnings(slots);
      expect(result[0].hasTravelWarning).toBe(false);
      expect(result[1].hasTravelWarning).toBe(false);
    });

    it('should sort slots by dayOfWeek then startTime', () => {
      const slots: MergedTimetableSlot[] = [
        createSlot({ dayOfWeek: 3, startTime: '09:00', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 2, startTime: '08:15', schoolId: schoolBId }),
        createSlot({ dayOfWeek: 2, startTime: '07:30', schoolId: schoolAId }),
      ];

      const result = service.detectTravelWarnings(slots);
      expect(result[0].dayOfWeek).toBe(2);
      expect(result[0].startTime).toBe('07:30');
      expect(result[1].dayOfWeek).toBe(2);
      expect(result[1].startTime).toBe('08:15');
      expect(result[2].dayOfWeek).toBe(3);
      expect(result[2].startTime).toBe('09:00');
    });

    it('should mark multiple travel warnings in a day with alternating schools', () => {
      const slots: MergedTimetableSlot[] = [
        createSlot({ dayOfWeek: 2, startTime: '07:30', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 2, startTime: '08:15', schoolId: schoolBId }),
        createSlot({ dayOfWeek: 2, startTime: '09:00', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 2, startTime: '09:45', schoolId: schoolBId }),
      ];

      const result = service.detectTravelWarnings(slots);
      expect(result[0].hasTravelWarning).toBe(false);
      expect(result[1].hasTravelWarning).toBe(true);
      expect(result[2].hasTravelWarning).toBe(true);
      expect(result[3].hasTravelWarning).toBe(true);
    });

    it('should not mutate the original array', () => {
      const slots: MergedTimetableSlot[] = [
        createSlot({ dayOfWeek: 3, startTime: '09:00', schoolId: schoolAId }),
        createSlot({ dayOfWeek: 2, startTime: '07:30', schoolId: schoolBId }),
      ];

      const result = service.detectTravelWarnings(slots);
      // Original order preserved
      expect(slots[0].dayOfWeek).toBe(3);
      expect(slots[1].dayOfWeek).toBe(2);
      // Sorted result
      expect(result[0].dayOfWeek).toBe(2);
      expect(result[1].dayOfWeek).toBe(3);
    });
  });

  describe('getMergedTimetable', () => {
    it('should return empty array when teacher has no accessible schools', async () => {
      mockGetAccessibleSchoolIds.mockResolvedValue([]);

      const result = await service.getMergedTimetable(teacherId, semesterId);
      expect(result).toEqual([]);
    });

    it('should return empty array when filterSchoolId not in accessible schools', async () => {
      mockGetAccessibleSchoolIds.mockResolvedValue([schoolAId]);

      const result = await service.getMergedTimetable(
        teacherId,
        semesterId,
        'non-existent-school',
      );
      expect(result).toEqual([]);
    });

    it('should return empty array when no published versions exist', async () => {
      mockGetAccessibleSchoolIds.mockResolvedValue([schoolAId, schoolBId]);
      mockVersionRepo.find.mockResolvedValue([]);

      const result = await service.getMergedTimetable(teacherId, semesterId);
      expect(result).toEqual([]);
    });

    it('should query slots from all published versions for accessible schools', async () => {
      mockGetAccessibleSchoolIds.mockResolvedValue([schoolAId, schoolBId]);

      mockVersionRepo.find.mockResolvedValue([
        { id: 'version-a', schoolId: schoolAId },
        { id: 'version-b', schoolId: schoolBId },
      ]);

      (mockDataSource.query as jest.Mock).mockResolvedValue([
        { name: 'Trường A', address: '123 Đường A' },
      ]);

      mockSlotQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: [
          createSlotEntity({
            id: 'slot-1',
            schoolId: schoolAId,
            dayOfWeek: 2,
            teacherId,
          }),
        ],
        raw: [],
      });

      const result = await service.getMergedTimetable(teacherId, semesterId);

      expect(mockGetAccessibleSchoolIds).toHaveBeenCalledWith(teacherId);
      expect(mockVersionRepo.find).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].schoolId).toBe(schoolAId);
    });

    it('should filter by schoolId when filterSchoolId is provided', async () => {
      mockGetAccessibleSchoolIds.mockResolvedValue([schoolAId, schoolBId]);

      mockVersionRepo.find.mockResolvedValue([
        { id: 'version-a', schoolId: schoolAId },
      ]);

      (mockDataSource.query as jest.Mock).mockResolvedValue([
        { name: 'Trường A', address: '123 Đường A' },
      ]);

      mockSlotQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: [
          createSlotEntity({
            id: 'slot-1',
            schoolId: schoolAId,
            dayOfWeek: 2,
            teacherId,
          }),
        ],
        raw: [],
      });

      const result = await service.getMergedTimetable(
        teacherId,
        semesterId,
        schoolAId,
      );
      expect(result).toHaveLength(1);
      expect(result[0].schoolId).toBe(schoolAId);
    });

    it('should apply travel warnings to returned slots', async () => {
      mockGetAccessibleSchoolIds.mockResolvedValue([schoolAId, schoolBId]);

      mockVersionRepo.find.mockResolvedValue([
        { id: 'version-a', schoolId: schoolAId },
        { id: 'version-b', schoolId: schoolBId },
      ]);

      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ name: 'Trường A', address: '123 Đường A' }])
        .mockResolvedValueOnce([{ name: 'Trường B', address: '456 Đường B' }]);

      mockSlotQueryBuilder.getRawAndEntities.mockResolvedValue({
        entities: [
          createSlotEntity({
            id: 'slot-1',
            schoolId: schoolAId,
            dayOfWeek: 2,
            teacherId,
            periodStartTime: '07:30',
          }),
          createSlotEntity({
            id: 'slot-2',
            schoolId: schoolBId,
            dayOfWeek: 2,
            teacherId,
            periodStartTime: '08:15',
          }),
        ],
        raw: [],
      });

      const result = await service.getMergedTimetable(teacherId, semesterId);
      expect(result).toHaveLength(2);
      expect(result[0].hasTravelWarning).toBe(false);
      expect(result[1].hasTravelWarning).toBe(true);
    });
  });
});

// Helper functions

function createSlot(
  overrides: Partial<MergedTimetableSlot> = {},
): MergedTimetableSlot {
  return {
    id: `slot-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek: 2,
    periodId: 'period-001',
    periodName: '1',
    startTime: '07:30',
    endTime: '08:15',
    classId: 'class-001',
    className: 'Lớp 10A1',
    subjectId: 'subject-001',
    subjectName: 'Toán',
    roomId: 'room-001',
    roomName: 'Phòng 101',
    schoolId: 'school-a',
    schoolName: 'Trường A',
    schoolAddress: '123 Đường A',
    hasTravelWarning: false,
    ...overrides,
  };
}

function createSlotEntity(
  overrides: {
    id?: string;
    schoolId?: string;
    dayOfWeek?: number;
    teacherId?: string;
    periodStartTime?: string;
    periodEndTime?: string;
  } = {},
) {
  return {
    id: overrides.id ?? 'slot-001',
    schoolId: overrides.schoolId ?? 'school-a',
    dayOfWeek: overrides.dayOfWeek ?? 2,
    teacherId: overrides.teacherId ?? 'teacher-001',
    periodId: 'period-001',
    classId: 'class-001',
    subjectId: 'subject-001',
    roomId: 'room-001',
    period: {
      periodNumber: 1,
      startTime: overrides.periodStartTime ?? '07:30',
      endTime: overrides.periodEndTime ?? '08:15',
    },
    class: { name: 'Lớp 10A1' },
    subject: { name: 'Toán' },
    room: { name: 'Phòng 101' },
  };
}
