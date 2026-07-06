import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ConflictOrchestrationService } from './conflict-orchestration.service';
import { ConflictDetectionService } from './conflict-detection.service';
import { ConflictSlotRepository } from '../repositories/conflict-slot.repository';
import { ConflictLogRepository } from '../repositories/conflict-log.repository';
import { CheckSlotConflictDto } from '../dto/check-slot-conflict.dto';
import { ConflictFilterDto } from '../dto/conflict-filter.dto';
import { Conflict, SlotCheckPayload } from '../interfaces/conflict.interface';
import {
  ConflictType,
  ConflictSeverity,
  ValidationContext,
} from '../enums/conflict.enum';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';

describe('ConflictOrchestrationService', () => {
  let service: ConflictOrchestrationService;
  let conflictDetectionService: jest.Mocked<ConflictDetectionService>;
  let conflictSlotRepository: jest.Mocked<ConflictSlotRepository>;
  let conflictLogRepository: jest.Mocked<ConflictLogRepository>;

  const mockSchoolId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockVersionId = '33333333-3333-3333-3333-333333333333';

  const mockIndexes: ConflictIndexes = {
    teacherTimeslot: new Map(),
    roomTimeslot: new Map(),
    classTimeslot: new Map(),
    teacherDayPeriods: new Map(),
    subjectDays: new Map(),
    teacherDaySlots: new Map(),
    periodOrderMap: new Map(),
    roomCampusMap: new Map(),
  };

  const mockDto: CheckSlotConflictDto = {
    versionId: mockVersionId,
    dayOfWeek: 2,
    periodId: '44444444-4444-4444-4444-444444444444',
    teacherId: '55555555-5555-5555-5555-555555555555',
    classId: '66666666-6666-6666-6666-666666666666',
    roomId: '77777777-7777-7777-7777-777777777777',
    subjectId: '88888888-8888-8888-8888-888888888888',
  };

  const makeConflict = (
    type: ConflictType,
    severity: ConflictSeverity,
    conflictingSlotId?: string,
  ): Conflict => ({
    type,
    severity,
    message: `Xung đột ${type}`,
    details: {
      conflictingSlotId:
        conflictingSlotId ?? '99999999-9999-9999-9999-999999999999',
      teacherId: mockDto.teacherId,
      classId: mockDto.classId,
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictOrchestrationService,
        {
          provide: ConflictDetectionService,
          useValue: {
            buildIndexes: jest.fn().mockReturnValue(mockIndexes),
            detectConflicts: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: ConflictSlotRepository,
          useValue: {
            loadExistingSlots: jest.fn().mockResolvedValue([]),
            loadAllSlotsByVersion: jest.fn().mockResolvedValue([]),
            loadPeriodOrderMap: jest.fn().mockResolvedValue(new Map()),
            loadRoomCampusMap: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: ConflictLogRepository,
          useValue: {
            createManyLogs: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<ConflictOrchestrationService>(
      ConflictOrchestrationService,
    );
    conflictDetectionService = module.get(ConflictDetectionService);
    conflictSlotRepository = module.get(ConflictSlotRepository);
    conflictLogRepository = module.get(ConflictLogRepository);
  });

  describe('checkSingleSlot', () => {
    it('should return empty result when no conflicts found', async () => {
      const result = await service.checkSingleSlot(
        mockDto,
        mockSchoolId,
        mockUserId,
      );

      expect(result).toEqual({
        hasHardConflicts: false,
        hasSoftConflicts: false,
        conflicts: [],
        hardCount: 0,
        softCount: 0,
      });
    });

    it('should load existing slots with correct parameters', async () => {
      await service.checkSingleSlot(mockDto, mockSchoolId, mockUserId);

      expect(conflictSlotRepository.loadExistingSlots).toHaveBeenCalledWith(
        mockDto.versionId,
        mockDto.dayOfWeek,
        mockDto.periodId,
        mockSchoolId,
      );
    });

    it('should load period order map and room campus map', async () => {
      await service.checkSingleSlot(mockDto, mockSchoolId, mockUserId);

      expect(conflictSlotRepository.loadPeriodOrderMap).toHaveBeenCalledWith(
        mockSchoolId,
      );
      expect(conflictSlotRepository.loadRoomCampusMap).toHaveBeenCalledWith(
        mockSchoolId,
      );
    });

    it('should use empty roomCampusMap when loadRoomCampusMap fails (graceful degradation)', async () => {
      conflictSlotRepository.loadRoomCampusMap.mockRejectedValue(
        new Error('DB error'),
      );

      await service.checkSingleSlot(mockDto, mockSchoolId, mockUserId);

      expect(conflictDetectionService.buildIndexes).toHaveBeenCalledWith(
        [],
        new Map(),
        new Map(),
      );
    });

    it('should pass repository data to buildIndexes', async () => {
      // Verify the service correctly passes repository results to buildIndexes
      // by checking the call chain: loadExistingSlots → buildIndexes (first arg)
      await service.checkSingleSlot(mockDto, mockSchoolId, mockUserId);

      // Verify loadExistingSlots was called correctly
      expect(conflictSlotRepository.loadExistingSlots).toHaveBeenCalledWith(
        mockDto.versionId,
        mockDto.dayOfWeek,
        mockDto.periodId,
        mockSchoolId,
      );

      // Verify buildIndexes received the results (empty from default mocks)
      expect(conflictDetectionService.buildIndexes).toHaveBeenCalledWith(
        [], // from loadExistingSlots mock default
        expect.any(Map), // from loadPeriodOrderMap
        expect.any(Map), // from loadRoomCampusMap
      );
    });

    it('should call detectConflicts with correct target and options', async () => {
      await service.checkSingleSlot(mockDto, mockSchoolId, mockUserId);

      expect(conflictDetectionService.detectConflicts).toHaveBeenCalledWith(
        {
          versionId: mockDto.versionId,
          dayOfWeek: mockDto.dayOfWeek,
          periodId: mockDto.periodId,
          teacherId: mockDto.teacherId,
          classId: mockDto.classId,
          roomId: mockDto.roomId,
          subjectId: mockDto.subjectId,
          excludeSlotId: undefined,
        },
        mockIndexes,
        {
          context: ValidationContext.SINGLE_SLOT,
          schoolId: mockSchoolId,
          skipSoftChecks: false,
        },
      );
    });

    it('should return correct result with hard and soft conflicts', async () => {
      const hardConflict = makeConflict(
        ConflictType.TEACHER_DOUBLE_BOOKED,
        ConflictSeverity.ERROR,
      );
      const softConflict = makeConflict(
        ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
        ConflictSeverity.WARNING,
      );

      conflictDetectionService.detectConflicts.mockReturnValue([
        hardConflict,
        softConflict,
      ]);

      const result = await service.checkSingleSlot(
        mockDto,
        mockSchoolId,
        mockUserId,
      );

      expect(result.hasHardConflicts).toBe(true);
      expect(result.hasSoftConflicts).toBe(true);
      expect(result.hardCount).toBe(1);
      expect(result.softCount).toBe(1);
      expect(result.conflicts).toHaveLength(2);
    });

    it('should log conflicts when conflicts are detected', async () => {
      const conflict = makeConflict(
        ConflictType.TEACHER_DOUBLE_BOOKED,
        ConflictSeverity.ERROR,
      );
      conflictDetectionService.detectConflicts.mockReturnValue([conflict]);

      await service.checkSingleSlot(mockDto, mockSchoolId, mockUserId);

      expect(conflictLogRepository.createManyLogs).toHaveBeenCalledWith([
        expect.objectContaining({
          schoolId: mockSchoolId,
          versionId: mockDto.versionId,
          conflictType: ConflictType.TEACHER_DOUBLE_BOOKED,
          severity: ConflictSeverity.ERROR,
          dayOfWeek: mockDto.dayOfWeek,
          periodId: mockDto.periodId,
          teacherId: mockDto.teacherId,
          classId: mockDto.classId,
          roomId: mockDto.roomId,
          subjectId: mockDto.subjectId,
          validationContext: ValidationContext.SINGLE_SLOT,
        }),
      ]);
    });

    it('should NOT log when no conflicts detected', async () => {
      conflictDetectionService.detectConflicts.mockReturnValue([]);

      await service.checkSingleSlot(mockDto, mockSchoolId, mockUserId);

      expect(conflictLogRepository.createManyLogs).not.toHaveBeenCalled();
    });

    it('should handle log creation failure gracefully', async () => {
      const conflict = makeConflict(
        ConflictType.TEACHER_DOUBLE_BOOKED,
        ConflictSeverity.ERROR,
      );
      conflictDetectionService.detectConflicts.mockReturnValue([conflict]);
      conflictLogRepository.createManyLogs.mockRejectedValue(
        new Error('DB failure'),
      );

      // Should not throw
      const result = await service.checkSingleSlot(
        mockDto,
        mockSchoolId,
        mockUserId,
      );
      expect(result.conflicts).toHaveLength(1);
    });

    it('should set roomId to null when dto.roomId is undefined', async () => {
      const dtoNoRoom = { ...mockDto, roomId: undefined };
      await service.checkSingleSlot(dtoNoRoom, mockSchoolId, mockUserId);

      expect(conflictDetectionService.detectConflicts).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: null }),
        mockIndexes,
        expect.any(Object),
      );
    });
  });

  describe('checkFullVersion', () => {
    it('should return empty result when no slots exist', async () => {
      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue([]);

      const result = await service.checkFullVersion(
        mockVersionId,
        mockSchoolId,
      );

      expect(result).toEqual({
        versionId: mockVersionId,
        totalSlots: 0,
        totalConflicts: 0,
        hardCount: 0,
        softCount: 0,
        byType: {
          [ConflictType.TEACHER_DOUBLE_BOOKED]: [],
          [ConflictType.ROOM_DOUBLE_BOOKED]: [],
          [ConflictType.CLASS_DOUBLE_BOOKED]: [],
          [ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED]: [],
          [ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME]: [],
          [ConflictType.SUBJECT_CONSECUTIVE_DAYS]: [],
          [ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED]: [],
        },
        conflicts: [],
      });
    });

    it('should build indexes once for all slots', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          subjectId: 's1',
        },
        {
          id: 'slot-2',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p2',
          teacherId: 't1',
          classId: 'c2',
          roomId: 'r2',
          subjectId: 's2',
        },
      ] as unknown as TimetableSlotEntity[];

      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(mockSlots);

      await service.checkFullVersion(mockVersionId, mockSchoolId);

      // buildIndexes called exactly once
      expect(conflictDetectionService.buildIndexes).toHaveBeenCalledTimes(1);
      // detectConflicts called once per slot
      expect(conflictDetectionService.detectConflicts).toHaveBeenCalledTimes(2);
    });

    it('should exclude self from detection (excludeSlotId = slot.id)', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          subjectId: 's1',
        },
      ] as unknown as TimetableSlotEntity[];

      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(mockSlots);

      await service.checkFullVersion(mockVersionId, mockSchoolId);

      expect(conflictDetectionService.detectConflicts).toHaveBeenCalledWith(
        expect.objectContaining({ excludeSlotId: 'slot-1' }),
        mockIndexes,
        expect.objectContaining({
          context: ValidationContext.FULL_VERSION,
          schoolId: mockSchoolId,
        }),
      );
    });

    it('should deduplicate conflicts by signature (A→B = B→A)', async () => {
      const mockSlots = [
        {
          id: 'slot-A',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          subjectId: 's1',
        },
        {
          id: 'slot-B',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c2',
          roomId: 'r2',
          subjectId: 's2',
        },
      ] as unknown as TimetableSlotEntity[];

      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(mockSlots);

      // Simulate: slot-A reports conflict with slot-B, and slot-B reports conflict with slot-A
      conflictDetectionService.detectConflicts
        .mockReturnValueOnce([
          {
            type: ConflictType.TEACHER_DOUBLE_BOOKED,
            severity: ConflictSeverity.ERROR,
            message: 'GV trùng lịch',
            details: {
              targetSlotId: 'slot-A',
              conflictingSlotId: 'slot-B',
              teacherId: 't1',
            },
          },
        ])
        .mockReturnValueOnce([
          {
            type: ConflictType.TEACHER_DOUBLE_BOOKED,
            severity: ConflictSeverity.ERROR,
            message: 'GV trùng lịch',
            details: {
              targetSlotId: 'slot-B',
              conflictingSlotId: 'slot-A',
              teacherId: 't1',
            },
          },
        ]);

      const result = await service.checkFullVersion(
        mockVersionId,
        mockSchoolId,
      );

      // Should be deduplicated to 1 conflict
      expect(result.totalConflicts).toBe(1);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should group conflicts by type', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          subjectId: 's1',
        },
      ] as unknown as TimetableSlotEntity[];

      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(mockSlots);

      conflictDetectionService.detectConflicts.mockReturnValue([
        makeConflict(
          ConflictType.TEACHER_DOUBLE_BOOKED,
          ConflictSeverity.ERROR,
          'slot-x',
        ),
        makeConflict(
          ConflictType.ROOM_DOUBLE_BOOKED,
          ConflictSeverity.ERROR,
          'slot-y',
        ),
      ]);

      const result = await service.checkFullVersion(
        mockVersionId,
        mockSchoolId,
      );

      expect(result.byType[ConflictType.TEACHER_DOUBLE_BOOKED]).toHaveLength(1);
      expect(result.byType[ConflictType.ROOM_DOUBLE_BOOKED]).toHaveLength(1);
    });

    it('should apply type filter', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          subjectId: 's1',
        },
      ] as unknown as TimetableSlotEntity[];

      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(mockSlots);

      conflictDetectionService.detectConflicts.mockReturnValue([
        makeConflict(
          ConflictType.TEACHER_DOUBLE_BOOKED,
          ConflictSeverity.ERROR,
          'slot-x',
        ),
        makeConflict(
          ConflictType.ROOM_DOUBLE_BOOKED,
          ConflictSeverity.ERROR,
          'slot-y',
        ),
      ]);

      const filters: ConflictFilterDto = {
        type: ConflictType.TEACHER_DOUBLE_BOOKED,
      };
      const result = await service.checkFullVersion(
        mockVersionId,
        mockSchoolId,
        filters,
      );

      expect(result.totalConflicts).toBe(1);
      expect(result.conflicts[0].type).toBe(ConflictType.TEACHER_DOUBLE_BOOKED);
    });

    it('should apply severity filter', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          subjectId: 's1',
        },
      ] as unknown as TimetableSlotEntity[];

      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(mockSlots);

      conflictDetectionService.detectConflicts.mockReturnValue([
        makeConflict(
          ConflictType.TEACHER_DOUBLE_BOOKED,
          ConflictSeverity.ERROR,
          'slot-x',
        ),
        makeConflict(
          ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
          ConflictSeverity.WARNING,
          'slot-y',
        ),
      ]);

      const filters: ConflictFilterDto = { severity: ConflictSeverity.WARNING };
      const result = await service.checkFullVersion(
        mockVersionId,
        mockSchoolId,
        filters,
      );

      expect(result.totalConflicts).toBe(1);
      expect(result.conflicts[0].severity).toBe(ConflictSeverity.WARNING);
    });

    it('should apply teacherId filter', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          versionId: mockVersionId,
          dayOfWeek: 2,
          periodId: 'p1',
          teacherId: 't1',
          classId: 'c1',
          roomId: 'r1',
          subjectId: 's1',
        },
      ] as unknown as TimetableSlotEntity[];

      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(mockSlots);

      const conflict1: Conflict = {
        type: ConflictType.TEACHER_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Conflict',
        details: { teacherId: 'teacher-A', conflictingSlotId: 'slot-x' },
      };
      const conflict2: Conflict = {
        type: ConflictType.TEACHER_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Conflict',
        details: { teacherId: 'teacher-B', conflictingSlotId: 'slot-y' },
      };

      conflictDetectionService.detectConflicts.mockReturnValue([
        conflict1,
        conflict2,
      ]);

      const filters: ConflictFilterDto = { teacherId: 'teacher-A' };
      const result = await service.checkFullVersion(
        mockVersionId,
        mockSchoolId,
        filters,
      );

      expect(result.totalConflicts).toBe(1);
      expect(result.conflicts[0].details.teacherId).toBe('teacher-A');
    });

    it('should use graceful degradation for roomCampusMap in full version', async () => {
      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue([]);
      conflictSlotRepository.loadRoomCampusMap.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.checkFullVersion(
        mockVersionId,
        mockSchoolId,
      );

      expect(result.totalSlots).toBe(0);
      expect(conflictDetectionService.buildIndexes).toHaveBeenCalledWith(
        [],
        new Map(),
        new Map(),
      );
    });

    it('should throw HttpException(408) when timeout exceeded', async () => {
      // Replace the FULL_VERSION_TIMEOUT_MS by making the operation take longer than the timeout
      // We'll mock the loadAllSlotsByVersion to take 11s, and the service has a 10s timeout
      conflictSlotRepository.loadAllSlotsByVersion.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 11_000)),
      );

      const promise = service.checkFullVersion(mockVersionId, mockSchoolId);

      await expect(promise).rejects.toThrow(HttpException);
    }, 12_000);
  });
});
