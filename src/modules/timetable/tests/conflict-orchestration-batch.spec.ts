import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConflictOrchestrationService } from '../services/conflict-orchestration.service';
import { ConflictDetectionService } from '../services/conflict-detection.service';
import { ConflictSlotRepository } from '../repositories/conflict-slot.repository';
import { ConflictLogRepository } from '../repositories/conflict-log.repository';
import {
  ConflictSeverity,
  ConflictType,
  ConflictLogStatus,
} from '../enums/conflict.enum';
import { SlotCheckPayload, Conflict } from '../interfaces/conflict.interface';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';

describe('ConflictOrchestrationService - Batch & Override', () => {
  let service: ConflictOrchestrationService;
  let conflictDetectionService: jest.Mocked<ConflictDetectionService>;
  let conflictSlotRepository: jest.Mocked<ConflictSlotRepository>;
  let conflictLogRepository: jest.Mocked<ConflictLogRepository>;

  const mockSchoolId = 'school-uuid-001';
  const mockVersionId = 'version-uuid-001';
  const mockUserId = 'user-uuid-001';

  const mockPeriodOrderMap = new Map<string, number>([
    ['period-1', 1],
    ['period-2', 2],
    ['period-3', 3],
  ]);

  const mockRoomCampusMap = new Map<string, string>([
    ['room-1', 'campus-A'],
    ['room-2', 'campus-B'],
  ]);

  const createMockIndexes = (): ConflictIndexes => ({
    teacherTimeslot: new Map(),
    roomTimeslot: new Map(),
    classTimeslot: new Map(),
    teacherDayPeriods: new Map(),
    subjectDays: new Map(),
    teacherDaySlots: new Map(),
    periodOrderMap: mockPeriodOrderMap,
    roomCampusMap: mockRoomCampusMap,
  });

  const createMockSlotPayload = (
    overrides?: Partial<SlotCheckPayload>,
  ): SlotCheckPayload => ({
    versionId: mockVersionId,
    dayOfWeek: 2,
    periodId: 'period-1',
    teacherId: 'teacher-1',
    classId: 'class-1',
    roomId: 'room-1',
    subjectId: 'subject-1',
    ...overrides,
  });

  beforeEach(async () => {
    const mockConflictDetectionService = {
      buildIndexes: jest.fn().mockReturnValue(createMockIndexes()),
      detectConflicts: jest.fn().mockReturnValue([]),
    };

    const mockConflictSlotRepository = {
      loadAllSlotsByVersion: jest.fn().mockResolvedValue([]),
      loadExistingSlots: jest.fn().mockResolvedValue([]),
      loadPeriodOrderMap: jest.fn().mockResolvedValue(mockPeriodOrderMap),
      loadRoomCampusMap: jest.fn().mockResolvedValue(mockRoomCampusMap),
    };

    const mockConflictLogRepository = {
      createLog: jest.fn().mockResolvedValue({}),
      createManyLogs: jest.fn().mockResolvedValue([]),
      findByIds: jest.fn().mockResolvedValue([]),
      updateOverride: jest.fn().mockResolvedValue(undefined),
      findByVersion: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictOrchestrationService,
        {
          provide: ConflictDetectionService,
          useValue: mockConflictDetectionService,
        },
        {
          provide: ConflictSlotRepository,
          useValue: mockConflictSlotRepository,
        },
        { provide: ConflictLogRepository, useValue: mockConflictLogRepository },
      ],
    }).compile();

    service = module.get<ConflictOrchestrationService>(
      ConflictOrchestrationService,
    );
    conflictDetectionService = module.get(ConflictDetectionService);
    conflictSlotRepository = module.get(ConflictSlotRepository);
    conflictLogRepository = module.get(ConflictLogRepository);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkBatch tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('checkBatch', () => {
    it('should return empty conflicts for a batch with no conflicts', async () => {
      const slots = [
        createMockSlotPayload(),
        createMockSlotPayload({ teacherId: 'teacher-2' }),
      ];

      const result = await service.checkBatch(
        slots,
        mockVersionId,
        mockSchoolId,
      );

      expect(result.totalSlots).toBe(2);
      expect(result.validSlots).toBe(2);
      expect(result.invalidSlots).toBe(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.canProceedWithOverride).toBe(true);
    });

    it('should detect conflicts for slots with hard constraint violations', async () => {
      const hardConflict: Conflict = {
        type: ConflictType.TEACHER_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Giáo viên đã có tiết dạy vào thời điểm này',
        details: { teacherId: 'teacher-1' },
      };

      // First slot has no conflicts, second slot has a hard conflict
      conflictDetectionService.detectConflicts
        .mockReturnValueOnce([])
        .mockReturnValueOnce([hardConflict]);

      const slots = [
        createMockSlotPayload(),
        createMockSlotPayload({ teacherId: 'teacher-1', classId: 'class-2' }),
      ];

      const result = await service.checkBatch(
        slots,
        mockVersionId,
        mockSchoolId,
      );

      expect(result.totalSlots).toBe(2);
      expect(result.validSlots).toBe(1);
      expect(result.invalidSlots).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].rowIndex).toBe(1);
      expect(result.conflicts[0].conflicts[0].type).toBe(
        ConflictType.TEACHER_DOUBLE_BOOKED,
      );
      expect(result.canProceedWithOverride).toBe(false);
    });

    it('should set canProceedWithOverride true when only soft conflicts exist', async () => {
      const softConflict: Conflict = {
        type: ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
        severity: ConflictSeverity.WARNING,
        message: 'Giáo viên dạy quá số tiết liên tiếp tối đa',
        details: { currentCount: 5, maxAllowed: 4 },
      };

      conflictDetectionService.detectConflicts.mockReturnValueOnce([
        softConflict,
      ]);

      const slots = [createMockSlotPayload()];

      const result = await service.checkBatch(
        slots,
        mockVersionId,
        mockSchoolId,
      );

      expect(result.canProceedWithOverride).toBe(true);
      expect(result.invalidSlots).toBe(0);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should load existing slots and build indexes for the version', async () => {
      const existingSlots = [{ id: 'existing-1' } as TimetableSlotEntity];
      conflictSlotRepository.loadAllSlotsByVersion.mockResolvedValue(
        existingSlots,
      );

      const slots = [createMockSlotPayload()];
      await service.checkBatch(slots, mockVersionId, mockSchoolId);

      expect(conflictSlotRepository.loadAllSlotsByVersion).toHaveBeenCalledWith(
        mockVersionId,
        mockSchoolId,
      );
      expect(conflictDetectionService.buildIndexes).toHaveBeenCalledWith(
        existingSlots,
        mockPeriodOrderMap,
        mockRoomCampusMap,
      );
    });

    it('should handle graceful degradation when periodOrderMap fails', async () => {
      conflictSlotRepository.loadPeriodOrderMap.mockRejectedValue(
        new Error('DB error'),
      );

      const slots = [createMockSlotPayload()];
      const result = await service.checkBatch(
        slots,
        mockVersionId,
        mockSchoolId,
      );

      expect(result.totalSlots).toBe(1);
      // Should still proceed with empty periodOrderMap
      expect(conflictDetectionService.buildIndexes).toHaveBeenCalledWith(
        expect.anything(),
        new Map(),
        expect.anything(),
      );
    });

    it('should handle graceful degradation when roomCampusMap fails', async () => {
      conflictSlotRepository.loadRoomCampusMap.mockRejectedValue(
        new Error('DB error'),
      );

      const slots = [createMockSlotPayload()];
      const result = await service.checkBatch(
        slots,
        mockVersionId,
        mockSchoolId,
      );

      expect(result.totalSlots).toBe(1);
      expect(conflictDetectionService.buildIndexes).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        new Map(),
      );
    });

    it('should call detectConflicts for each slot in the batch', async () => {
      const slots = [
        createMockSlotPayload(),
        createMockSlotPayload({ teacherId: 'teacher-2' }),
        createMockSlotPayload({ teacherId: 'teacher-3' }),
      ];

      await service.checkBatch(slots, mockVersionId, mockSchoolId);

      expect(conflictDetectionService.detectConflicts).toHaveBeenCalledTimes(3);
    });

    it('should correctly count invalid slots (slots with hard conflicts)', async () => {
      const hardConflict: Conflict = {
        type: ConflictType.ROOM_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        message: 'Phòng học đã được sử dụng',
        details: { roomId: 'room-1' },
      };

      const softConflict: Conflict = {
        type: ConflictType.SUBJECT_CONSECUTIVE_DAYS,
        severity: ConflictSeverity.WARNING,
        message: 'Môn học bị xếp liên tiếp',
        details: {},
      };

      conflictDetectionService.detectConflicts
        .mockReturnValueOnce([hardConflict])
        .mockReturnValueOnce([softConflict])
        .mockReturnValueOnce([]);

      const slots = [
        createMockSlotPayload(),
        createMockSlotPayload({ classId: 'class-2' }),
        createMockSlotPayload({ classId: 'class-3' }),
      ];

      const result = await service.checkBatch(
        slots,
        mockVersionId,
        mockSchoolId,
      );

      expect(result.totalSlots).toBe(3);
      expect(result.invalidSlots).toBe(1); // Only slot with hard conflict
      expect(result.validSlots).toBe(2); // Soft conflict slot + no conflict slot
      expect(result.canProceedWithOverride).toBe(false); // Has hard conflict
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // overrideSoftConflicts tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('overrideSoftConflicts', () => {
    const mockSlotId = 'slot-uuid-001';
    const validOverride = {
      reason: 'Giáo viên đã xác nhận có thể dạy liên tiếp',
    };

    it('should successfully override soft conflicts with valid reason', async () => {
      const mockLogs = [
        { id: 'log-1', severity: ConflictSeverity.WARNING },
        { id: 'log-2', severity: ConflictSeverity.WARNING },
      ];
      conflictLogRepository.findByIds.mockResolvedValue(mockLogs as any);

      await service.overrideSoftConflicts(
        mockSlotId,
        ['log-1', 'log-2'],
        validOverride,
        mockUserId,
        mockSchoolId,
      );

      expect(conflictLogRepository.updateOverride).toHaveBeenCalledTimes(2);
      expect(conflictLogRepository.updateOverride).toHaveBeenCalledWith(
        'log-1',
        mockUserId,
        validOverride.reason,
      );
      expect(conflictLogRepository.updateOverride).toHaveBeenCalledWith(
        'log-2',
        mockUserId,
        validOverride.reason,
      );
    });

    it('should throw 400 when override reason is less than 10 characters', async () => {
      const shortReason = { reason: 'Short' };

      try {
        await service.overrideSoftConflicts(
          mockSlotId,
          ['log-1'],
          shortReason,
          mockUserId,
          mockSchoolId,
        );
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.BAD_REQUEST,
        );
        const response = (error as HttpException).getResponse() as any;
        expect(response.errorCode).toBe('OVERRIDE_REASON_TOO_SHORT');
        expect(response.message).toBe('Lý do ghi đè phải có ít nhất 10 ký tự');
      }
    });

    it('should throw 400 when override reason is empty', async () => {
      const emptyReason = { reason: '' };

      try {
        await service.overrideSoftConflicts(
          mockSlotId,
          ['log-1'],
          emptyReason,
          mockUserId,
          mockSchoolId,
        );
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.BAD_REQUEST,
        );
      }
    });

    it('should throw 404 when conflict log IDs not found', async () => {
      // Only 1 log found when 2 were requested
      conflictLogRepository.findByIds.mockResolvedValue([
        { id: 'log-1', severity: ConflictSeverity.WARNING },
      ] as any);

      try {
        await service.overrideSoftConflicts(
          mockSlotId,
          ['log-1', 'log-2'],
          validOverride,
          mockUserId,
          mockSchoolId,
        );
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
        const response = (error as HttpException).getResponse() as any;
        expect(response.errorCode).toBe('CONFLICT_LOG_NOT_FOUND');
        expect(response.message).toBe('Không tìm thấy bản ghi xung đột');
      }
    });

    it('should throw 422 when any conflict log has severity ERROR', async () => {
      const mixedLogs = [
        { id: 'log-1', severity: ConflictSeverity.WARNING },
        { id: 'log-2', severity: ConflictSeverity.ERROR }, // Hard conflict!
      ];
      conflictLogRepository.findByIds.mockResolvedValue(mixedLogs as any);

      try {
        await service.overrideSoftConflicts(
          mockSlotId,
          ['log-1', 'log-2'],
          validOverride,
          mockUserId,
          mockSchoolId,
        );
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
        const response = (error as HttpException).getResponse() as any;
        expect(response.errorCode).toBe('HARD_CONFLICT_DETECTED');
        expect(response.message).toBe('Phát hiện xung đột cứng, không thể lưu');
      }
    });

    it('should throw 422 when ALL conflict logs have severity ERROR', async () => {
      const hardLogs = [{ id: 'log-1', severity: ConflictSeverity.ERROR }];
      conflictLogRepository.findByIds.mockResolvedValue(hardLogs as any);

      try {
        await service.overrideSoftConflicts(
          mockSlotId,
          ['log-1'],
          validOverride,
          mockUserId,
          mockSchoolId,
        );
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    });

    it('should not call updateOverride if validation fails', async () => {
      const shortReason = { reason: '短' };

      try {
        await service.overrideSoftConflicts(
          mockSlotId,
          ['log-1'],
          shortReason,
          mockUserId,
          mockSchoolId,
        );
      } catch {
        // expected
      }

      expect(conflictLogRepository.updateOverride).not.toHaveBeenCalled();
    });

    it('should handle override with exactly 10 characters reason', async () => {
      const exactTenChars = { reason: '1234567890' }; // exactly 10 chars
      const mockLogs = [{ id: 'log-1', severity: ConflictSeverity.WARNING }];
      conflictLogRepository.findByIds.mockResolvedValue(mockLogs as any);

      await service.overrideSoftConflicts(
        mockSlotId,
        ['log-1'],
        exactTenChars,
        mockUserId,
        mockSchoolId,
      );

      expect(conflictLogRepository.updateOverride).toHaveBeenCalledWith(
        'log-1',
        mockUserId,
        '1234567890',
      );
    });
  });
});
