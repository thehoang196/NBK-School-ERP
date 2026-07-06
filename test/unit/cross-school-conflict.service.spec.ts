import {
  ConflictDetectionService,
  ConflictType,
  CrossSchoolBusySlot,
} from '../../src/modules/timetable/services/conflict-detection.service';
import { TimetableSlotRepository } from '../../src/modules/timetable/repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../../src/modules/timetable/repositories/timetable-version.repository';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TimetableVersionStatus } from '../../src/common/enums/status.enum';
import { Repository } from 'typeorm';
import { TeacherEntity } from '../../src/modules/teacher/entities/teacher.entity';
import { TimetableVersionEntity } from '../../src/modules/timetable/entities/timetable-version.entity';

describe('ConflictDetectionService — Cross-School Methods', () => {
  let service: ConflictDetectionService;
  let slotRepository: jest.Mocked<TimetableSlotRepository>;
  let versionRepository: jest.Mocked<TimetableVersionRepository>;
  let teacherRepo: jest.Mocked<Repository<TeacherEntity>>;
  let timetableVersionRepo: jest.Mocked<Repository<TimetableVersionEntity>>;
  let teacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;

  // Mock checker stubs (not relevant for cross-school tests but required by constructor)
  const mockChecker = { check: jest.fn().mockReturnValue([]) };

  // Test constants
  const teacherId = 'teacher-uuid-1';
  const schoolAId = 'school-a-uuid';
  const schoolBId = 'school-b-uuid';
  const schoolCId = 'school-c-uuid';
  const semesterId = 'semester-uuid-1';
  const versionAId = 'version-a-uuid';
  const versionBId = 'version-b-uuid';

  beforeEach(() => {
    slotRepository = {
      findCrossSchoolSlots: jest.fn(),
      findConflicts: jest.fn(),
      findByVersion: jest.fn(),
      findByQuery: jest.fn(),
    } as unknown as jest.Mocked<TimetableSlotRepository>;

    versionRepository = {
      update: jest.fn(),
    } as unknown as jest.Mocked<TimetableVersionRepository>;

    teacherRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<TeacherEntity>>;

    timetableVersionRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<TimetableVersionEntity>>;

    teacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn(),
    } as unknown as jest.Mocked<TeacherSchoolAssignmentService>;

    service = new ConflictDetectionService(
      slotRepository,
      versionRepository,
      teacherRepo,
      timetableVersionRepo,
      mockChecker as any, // teacherDoubleBookedChecker
      mockChecker as any, // roomDoubleBookedChecker
      mockChecker as any, // classDoubleBookedChecker
      mockChecker as any, // teacherMaxConsecutiveChecker
      mockChecker as any, // teacherTravelTimeChecker
      mockChecker as any, // subjectConsecutiveDaysChecker
      mockChecker as any, // teacherMaxPerDayChecker
      teacherSchoolAssignmentService,
    );
  });

  afterEach(() => {
    // Clear cache between tests
    service.invalidateCrossSchoolCache(teacherId);
  });

  describe('checkCrossSchoolConflicts()', () => {
    it('should return conflict record with school info when conflict is found', async () => {
      // Teacher assigned to schools A and B
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
        schoolBId,
      ]);

      // Published version at school B for this semester
      timetableVersionRepo.find.mockResolvedValue([
        { id: versionBId, schoolId: schoolBId } as TimetableVersionEntity,
      ]);

      // Teacher has a slot at school B on same day/period
      slotRepository.findCrossSchoolSlots.mockResolvedValue([
        {
          id: 'slot-b-1',
          dayOfWeek: 2,
          periodId: 'period-1',
          versionId: versionBId,
          schoolId: schoolBId,
        } as any,
      ]);

      const result = await service.checkCrossSchoolConflicts(
        teacherId,
        2, // dayOfWeek (Tuesday)
        'period-1',
        schoolAId, // current school
        semesterId,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: ConflictType.CROSS_SCHOOL_CONFLICT,
        severity: 'error',
        message: 'Giáo viên đã có tiết dạy tại trường khác vào thời điểm này',
        details: {
          teacherId,
          dayOfWeek: 2,
          periodId: 'period-1',
        },
      });
    });

    it('should return empty array when no conflict exists', async () => {
      // Teacher assigned to schools A and B
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
        schoolBId,
      ]);

      // Published version at school B
      timetableVersionRepo.find.mockResolvedValue([
        { id: versionBId, schoolId: schoolBId } as TimetableVersionEntity,
      ]);

      // Teacher has a slot at school B but on a DIFFERENT day/period
      slotRepository.findCrossSchoolSlots.mockResolvedValue([
        {
          id: 'slot-b-1',
          dayOfWeek: 3, // Wednesday — different from queried Tuesday
          periodId: 'period-2',
          versionId: versionBId,
          schoolId: schoolBId,
        } as any,
      ]);

      const result = await service.checkCrossSchoolConflicts(
        teacherId,
        2, // Tuesday
        'period-1',
        schoolAId,
        semesterId,
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when teacher has only one school', async () => {
      // Teacher only assigned to school A (single school teacher)
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
      ]);

      // No other published versions
      timetableVersionRepo.find.mockResolvedValue([]);

      const result = await service.checkCrossSchoolConflicts(
        teacherId,
        2,
        'period-1',
        schoolAId,
        semesterId,
      );

      expect(result).toEqual([]);
      // Should not query slots when there's nothing to check
      expect(slotRepository.findCrossSchoolSlots).not.toHaveBeenCalled();
    });

    it('should use cache on second call and not query DB again', async () => {
      // Teacher assigned to schools A and B
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
        schoolBId,
      ]);

      timetableVersionRepo.find.mockResolvedValue([
        { id: versionBId, schoolId: schoolBId } as TimetableVersionEntity,
      ]);

      slotRepository.findCrossSchoolSlots.mockResolvedValue([
        {
          id: 'slot-b-1',
          dayOfWeek: 2,
          periodId: 'period-1',
          versionId: versionBId,
          schoolId: schoolBId,
        } as any,
      ]);

      // First call — queries DB
      const result1 = await service.checkCrossSchoolConflicts(
        teacherId,
        2,
        'period-1',
        schoolAId,
        semesterId,
      );

      expect(result1).toHaveLength(1);
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(1);
      expect(
        teacherSchoolAssignmentService.getAccessibleSchoolIds,
      ).toHaveBeenCalledTimes(1);

      // Second call — should use cache, no additional DB calls
      const result2 = await service.checkCrossSchoolConflicts(
        teacherId,
        2,
        'period-1',
        schoolAId,
        semesterId,
      );

      expect(result2).toHaveLength(1);
      // DB queries should NOT have been called again
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(1);
      expect(
        teacherSchoolAssignmentService.getAccessibleSchoolIds,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCrossSchoolBusySlots()', () => {
    it('should return all busy slots from other schools', async () => {
      // Teacher assigned to schools A, B, C
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
        schoolBId,
        schoolCId,
      ]);

      timetableVersionRepo.find.mockResolvedValue([
        { id: versionAId, schoolId: schoolAId } as TimetableVersionEntity,
        { id: versionBId, schoolId: schoolBId } as TimetableVersionEntity,
      ]);

      slotRepository.findCrossSchoolSlots.mockResolvedValue([
        {
          id: 'slot-a-1',
          dayOfWeek: 2,
          periodId: 'period-1',
          versionId: versionAId,
          schoolId: schoolAId,
        } as any,
        {
          id: 'slot-b-1',
          dayOfWeek: 3,
          periodId: 'period-2',
          versionId: versionBId,
          schoolId: schoolBId,
        } as any,
        {
          id: 'slot-b-2',
          dayOfWeek: 4,
          periodId: 'period-3',
          versionId: versionBId,
          schoolId: schoolBId,
        } as any,
      ]);

      // Exclude school A — should return only school B slots
      const result = await service.getCrossSchoolBusySlots(
        teacherId,
        schoolAId,
        semesterId,
      );

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { dayOfWeek: 3, periodId: 'period-2', schoolId: schoolBId },
          { dayOfWeek: 4, periodId: 'period-3', schoolId: schoolBId },
        ]),
      );
      // Should not contain slots from excluded school A
      expect(result.every((slot) => slot.schoolId !== schoolAId)).toBe(true);
    });

    it('should return empty array when teacher has only one school', async () => {
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
      ]);
      timetableVersionRepo.find.mockResolvedValue([]);

      const result = await service.getCrossSchoolBusySlots(
        teacherId,
        schoolAId,
        semesterId,
      );

      expect(result).toEqual([]);
    });

    it('should use cache on subsequent calls', async () => {
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
        schoolBId,
      ]);

      timetableVersionRepo.find.mockResolvedValue([
        { id: versionBId, schoolId: schoolBId } as TimetableVersionEntity,
      ]);

      slotRepository.findCrossSchoolSlots.mockResolvedValue([
        {
          id: 'slot-b-1',
          dayOfWeek: 2,
          periodId: 'period-1',
          versionId: versionBId,
          schoolId: schoolBId,
        } as any,
      ]);

      // First call
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semesterId);
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(1);

      // Second call — should hit cache
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semesterId);
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateCrossSchoolCache()', () => {
    it('should invalidate cache for specific semester — next call queries DB again', async () => {
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
        schoolBId,
      ]);

      timetableVersionRepo.find.mockResolvedValue([
        { id: versionBId, schoolId: schoolBId } as TimetableVersionEntity,
      ]);

      slotRepository.findCrossSchoolSlots.mockResolvedValue([
        {
          id: 'slot-b-1',
          dayOfWeek: 2,
          periodId: 'period-1',
          versionId: versionBId,
          schoolId: schoolBId,
        } as any,
      ]);

      // First call — populates cache
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semesterId);
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(1);

      // Invalidate cache
      service.invalidateCrossSchoolCache(teacherId, semesterId);

      // Third call — should query DB again because cache was invalidated
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semesterId);
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(2);
    });

    it('should invalidate all semesters when semesterId not provided', async () => {
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([
        schoolAId,
        schoolBId,
      ]);

      timetableVersionRepo.find.mockResolvedValue([
        { id: versionBId, schoolId: schoolBId } as TimetableVersionEntity,
      ]);

      slotRepository.findCrossSchoolSlots.mockResolvedValue([]);

      const semester2Id = 'semester-uuid-2';

      // Populate cache for two semesters
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semesterId);
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semester2Id);
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(2);

      // Invalidate all semesters
      service.invalidateCrossSchoolCache(teacherId);

      // Both should trigger new DB queries
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semesterId);
      await service.getCrossSchoolBusySlots(teacherId, schoolAId, semester2Id);
      expect(slotRepository.findCrossSchoolSlots).toHaveBeenCalledTimes(4);
    });
  });
});
