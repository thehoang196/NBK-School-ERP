import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConflictController } from '../controllers/conflict.controller';
import { ConflictOrchestrationService } from '../services/conflict-orchestration.service';
import { ConflictLogRepository } from '../repositories/conflict-log.repository';
import { HardConflictDetectedException } from '../exceptions/conflict.exception';
import {
  ConflictCheckResult,
  BatchConflictResult,
  FullVersionConflictResult,
  Conflict,
} from '../interfaces/conflict.interface';
import {
  ConflictType,
  ConflictSeverity,
  ConflictLogStatus,
  ValidationContext,
} from '../enums/conflict.enum';
import { CheckSlotConflictDto } from '../dto/check-slot-conflict.dto';
import { CheckBatchConflictDto } from '../dto/check-batch-conflict.dto';
import { ConflictFilterDto } from '../dto/conflict-filter.dto';
import { OverrideConflictDto } from '../dto/override-conflict.dto';
import { ConflictLogFilterDto } from '../dto/conflict-log-filter.dto';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';

describe('ConflictController', () => {
  let controller: ConflictController;
  let orchestrationService: jest.Mocked<ConflictOrchestrationService>;
  let conflictLogRepository: jest.Mocked<ConflictLogRepository>;

  const schoolId = '99999999-9999-9999-9999-999999999999';
  const userId = '88888888-8888-8888-8888-888888888888';
  const versionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockUser: CurrentUserPayload = {
    id: userId,
    email: 'scheduler@nbk.edu.vn',
    role: 'SCHEDULER',
    schoolId,
  };

  beforeEach(async () => {
    const mockOrchestrationService = {
      checkSingleSlot: jest.fn(),
      checkFullVersion: jest.fn(),
      checkBatch: jest.fn(),
      overrideSoftConflicts: jest.fn(),
    };

    const mockConflictLogRepository = {
      findByVersion: jest.fn(),
      createLog: jest.fn(),
      createManyLogs: jest.fn(),
      updateOverride: jest.fn(),
      findByIds: jest.fn(),
      softDeleteByVersion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConflictController],
      providers: [
        {
          provide: ConflictOrchestrationService,
          useValue: mockOrchestrationService,
        },
        { provide: ConflictLogRepository, useValue: mockConflictLogRepository },
      ],
    }).compile();

    controller = module.get<ConflictController>(ConflictController);
    orchestrationService = module.get(ConflictOrchestrationService);
    conflictLogRepository = module.get(ConflictLogRepository);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POST /check — Single-slot conflict check
  // ═══════════════════════════════════════════════════════════════════════
  describe('POST /check (checkSlot)', () => {
    const dto: CheckSlotConflictDto = {
      versionId,
      dayOfWeek: 2,
      periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      roomId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    };

    it('should return 200 with ConflictCheckResult on happy path', async () => {
      const mockResult: ConflictCheckResult = {
        hasHardConflicts: false,
        hasSoftConflicts: false,
        conflicts: [],
        hardCount: 0,
        softCount: 0,
      };
      orchestrationService.checkSingleSlot.mockResolvedValue(mockResult);

      const result = await controller.checkSlot(dto, schoolId, mockUser);

      expect(result).toEqual({
        success: true,
        data: mockResult,
        message: 'Kiểm tra xung đột thành công',
      });
      expect(orchestrationService.checkSingleSlot).toHaveBeenCalledWith(
        dto,
        schoolId,
        userId,
      );
    });

    it('should return success with conflicts when conflicts are detected', async () => {
      const conflicts: Conflict[] = [
        {
          type: ConflictType.TEACHER_DOUBLE_BOOKED,
          severity: ConflictSeverity.ERROR,
          message: 'Giáo viên đã có tiết dạy tại thời điểm này',
          details: {
            teacherId: dto.teacherId,
            className: '10A1',
            subjectName: 'Toán',
          },
        },
      ];
      const mockResult: ConflictCheckResult = {
        hasHardConflicts: true,
        hasSoftConflicts: false,
        conflicts,
        hardCount: 1,
        softCount: 0,
      };
      orchestrationService.checkSingleSlot.mockResolvedValue(mockResult);

      const result = await controller.checkSlot(dto, schoolId, mockUser);

      expect(result.success).toBe(true);
      expect(result.data.hasHardConflicts).toBe(true);
      expect(result.data.conflicts).toHaveLength(1);
      expect(result.data.conflicts[0].type).toBe(
        ConflictType.TEACHER_DOUBLE_BOOKED,
      );
    });

    it('should throw 403 when schoolId is null', async () => {
      await expect(
        controller.checkSlot(dto, null as unknown as string, mockUser),
      ).rejects.toThrow(HttpException);

      await expect(
        controller.checkSlot(dto, null as unknown as string, mockUser),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POST /check-batch — Batch conflict check
  // ═══════════════════════════════════════════════════════════════════════
  describe('POST /check-batch (checkBatch)', () => {
    const batchDto: CheckBatchConflictDto = {
      versionId,
      slots: [
        {
          versionId,
          dayOfWeek: 2,
          periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          roomId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        },
        {
          versionId,
          dayOfWeek: 3,
          periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        },
      ],
    };

    it('should return 200 with BatchConflictResult on happy path', async () => {
      const mockResult: BatchConflictResult = {
        totalSlots: 2,
        validSlots: 2,
        invalidSlots: 0,
        conflicts: [],
        canProceedWithOverride: true,
      };
      orchestrationService.checkBatch.mockResolvedValue(mockResult);

      const result = await controller.checkBatch(batchDto, schoolId);

      expect(result).toEqual({
        success: true,
        data: mockResult,
        message: 'Kiểm tra xung đột batch thành công',
      });
      expect(orchestrationService.checkBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            versionId,
            dayOfWeek: 2,
            teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            roomId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          }),
          expect.objectContaining({
            versionId,
            dayOfWeek: 3,
            roomId: null, // roomId undefined → null
          }),
        ]),
        versionId,
        schoolId,
      );
    });

    it('should convert undefined roomId to null in slot payloads', async () => {
      const mockResult: BatchConflictResult = {
        totalSlots: 2,
        validSlots: 2,
        invalidSlots: 0,
        conflicts: [],
        canProceedWithOverride: true,
      };
      orchestrationService.checkBatch.mockResolvedValue(mockResult);

      await controller.checkBatch(batchDto, schoolId);

      const callArgs = orchestrationService.checkBatch.mock.calls[0][0];
      // Second slot has no roomId — should be converted to null
      expect(callArgs[1].roomId).toBeNull();
    });

    it('should throw 403 when schoolId is null', async () => {
      await expect(
        controller.checkBatch(batchDto, null as unknown as string),
      ).rejects.toThrow(HttpException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POST /check-version/:versionId — Full-version conflict check
  // ═══════════════════════════════════════════════════════════════════════
  describe('POST /check-version/:versionId (checkVersion)', () => {
    const filters: ConflictFilterDto = {} as ConflictFilterDto;

    it('should return 200 with FullVersionConflictResult on happy path', async () => {
      const mockResult: FullVersionConflictResult = {
        versionId,
        totalSlots: 100,
        totalConflicts: 2,
        hardCount: 1,
        softCount: 1,
        byType: {
          [ConflictType.TEACHER_DOUBLE_BOOKED]: [
            {
              type: ConflictType.TEACHER_DOUBLE_BOOKED,
              severity: ConflictSeverity.ERROR,
              message: 'GV trùng lịch',
              details: {},
            },
          ],
          [ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED]: [
            {
              type: ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED,
              severity: ConflictSeverity.WARNING,
              message: 'GV quá tải',
              details: { currentCount: 6, maxAllowed: 5 },
            },
          ],
        } as FullVersionConflictResult['byType'],
        conflicts: [],
      };
      orchestrationService.checkFullVersion.mockResolvedValue(mockResult);

      const result = await controller.checkVersion(
        versionId,
        filters,
        schoolId,
      );

      expect(result).toEqual({
        success: true,
        data: mockResult,
        message: 'Kiểm tra xung đột phiên bản thành công',
      });
      expect(orchestrationService.checkFullVersion).toHaveBeenCalledWith(
        versionId,
        schoolId,
        filters,
      );
    });

    it('should throw 403 when schoolId is null', async () => {
      await expect(
        controller.checkVersion(versionId, filters, null as unknown as string),
      ).rejects.toThrow(HttpException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POST /override — Override soft constraints
  // ═══════════════════════════════════════════════════════════════════════
  describe('POST /override (overrideConflicts)', () => {
    const overrideDto: OverrideConflictDto = {
      slotId: '11111111-1111-1111-1111-111111111111',
      conflictLogIds: [
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
      ],
      reason: 'Giáo viên đã xác nhận có thể dạy liên tiếp hôm nay',
    };

    it('should return 200 with null data on success', async () => {
      orchestrationService.overrideSoftConflicts.mockResolvedValue(undefined);

      const result = await controller.overrideConflicts(
        overrideDto,
        schoolId,
        mockUser,
      );

      expect(result).toEqual({
        success: true,
        data: null,
        message: 'Ghi đè xung đột mềm thành công',
      });
      expect(orchestrationService.overrideSoftConflicts).toHaveBeenCalledWith(
        overrideDto.slotId,
        overrideDto.conflictLogIds,
        { reason: overrideDto.reason },
        userId,
        schoolId,
      );
    });

    it('should throw 422 when orchestration throws HardConflictDetectedException', async () => {
      const hardConflicts: Conflict[] = [
        {
          type: ConflictType.TEACHER_DOUBLE_BOOKED,
          severity: ConflictSeverity.ERROR,
          message: 'Phát hiện xung đột cứng, không thể lưu',
          details: {},
        },
      ];
      orchestrationService.overrideSoftConflicts.mockRejectedValue(
        new HttpException(
          {
            success: false,
            data: null,
            message: 'Phát hiện xung đột cứng, không thể lưu',
            errorCode: 'HARD_CONFLICT_DETECTED',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        ),
      );

      await expect(
        controller.overrideConflicts(overrideDto, schoolId, mockUser),
      ).rejects.toThrow(HttpException);

      await expect(
        controller.overrideConflicts(overrideDto, schoolId, mockUser),
      ).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    });

    it('should throw 403 when schoolId is null', async () => {
      await expect(
        controller.overrideConflicts(
          overrideDto,
          null as unknown as string,
          mockUser,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GET /logs/:versionId — Conflict audit logs
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /logs/:versionId (getConflictLogs)', () => {
    const logFilters: ConflictLogFilterDto = Object.assign(
      new ConflictLogFilterDto(),
      {
        page: 1,
        limit: 10,
      },
    );

    it('should return 200 with paginated results', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          schoolId,
          versionId,
          conflictType: ConflictType.TEACHER_DOUBLE_BOOKED,
          severity: ConflictSeverity.ERROR,
          dayOfWeek: 2,
          periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          message: 'GV trùng lịch',
          status: ConflictLogStatus.DETECTED,
          detectedAt: new Date('2025-01-15'),
        },
        {
          id: 'log-2',
          schoolId,
          versionId,
          conflictType: ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED,
          severity: ConflictSeverity.WARNING,
          dayOfWeek: 3,
          periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          message: 'GV quá tải',
          status: ConflictLogStatus.OVERRIDDEN,
          detectedAt: new Date('2025-01-15'),
        },
      ];
      conflictLogRepository.findByVersion.mockResolvedValue([
        mockLogs as never,
        2,
      ]);

      const result = await controller.getConflictLogs(
        versionId,
        logFilters,
        schoolId,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
      expect(result.message).toBe(
        'Lấy danh sách audit log xung đột thành công',
      );
    });

    it('should pass filters to repository correctly', async () => {
      const filtersWithType: ConflictLogFilterDto = Object.assign(
        new ConflictLogFilterDto(),
        {
          page: 2,
          limit: 5,
          type: ConflictType.ROOM_DOUBLE_BOOKED,
          severity: ConflictSeverity.ERROR,
          teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        },
      );
      conflictLogRepository.findByVersion.mockResolvedValue([[], 0]);

      await controller.getConflictLogs(versionId, filtersWithType, schoolId);

      expect(conflictLogRepository.findByVersion).toHaveBeenCalledWith(
        versionId,
        schoolId,
        {
          type: ConflictType.ROOM_DOUBLE_BOOKED,
          severity: ConflictSeverity.ERROR,
          teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          classId: undefined,
          status: undefined,
        },
        { page: 2, limit: 5 },
      );
    });

    it('should calculate totalPages correctly', async () => {
      conflictLogRepository.findByVersion.mockResolvedValue([[], 25]);

      const filtersWithLimit: ConflictLogFilterDto = Object.assign(
        new ConflictLogFilterDto(),
        {
          page: 1,
          limit: 10,
        },
      );

      const result = await controller.getConflictLogs(
        versionId,
        filtersWithLimit,
        schoolId,
      );

      expect(result.meta.totalPages).toBe(3); // ceil(25/10) = 3
    });

    it('should throw 403 when schoolId is null', async () => {
      await expect(
        controller.getConflictLogs(
          versionId,
          logFilters,
          null as unknown as string,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Response format verification
  // ═══════════════════════════════════════════════════════════════════════
  describe('Response format verification', () => {
    it('all success responses match { success: true, data, message } shape', async () => {
      const mockCheckResult: ConflictCheckResult = {
        hasHardConflicts: false,
        hasSoftConflicts: false,
        conflicts: [],
        hardCount: 0,
        softCount: 0,
      };
      orchestrationService.checkSingleSlot.mockResolvedValue(mockCheckResult);

      const dto: CheckSlotConflictDto = {
        versionId,
        dayOfWeek: 2,
        periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      };

      const result = await controller.checkSlot(dto, schoolId, mockUser);

      // Verify standard response shape
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
    });

    it('override success response has data = null', async () => {
      orchestrationService.overrideSoftConflicts.mockResolvedValue(undefined);

      const overrideDto: OverrideConflictDto = {
        slotId: '11111111-1111-1111-1111-111111111111',
        conflictLogIds: ['22222222-2222-2222-2222-222222222222'],
        reason: 'Override reason that is long enough',
      };

      const result = await controller.overrideConflicts(
        overrideDto,
        schoolId,
        mockUser,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBeTruthy();
    });

    it('paginated response includes meta with page, limit, total, totalPages', async () => {
      conflictLogRepository.findByVersion.mockResolvedValue([[], 50]);

      const filters: ConflictLogFilterDto = Object.assign(
        new ConflictLogFilterDto(),
        {
          page: 2,
          limit: 20,
        },
      );

      const result = await controller.getConflictLogs(
        versionId,
        filters,
        schoolId,
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 50,
        totalPages: 3,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Error format verification
  // ═══════════════════════════════════════════════════════════════════════
  describe('Error format verification', () => {
    it('SchoolContextRequiredException response matches { success: false, data, message, errorCode }', async () => {
      const dto: CheckSlotConflictDto = {
        versionId,
        dayOfWeek: 2,
        periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      };

      try {
        await controller.checkSlot(dto, null as unknown as string, mockUser);
        fail('Expected exception to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.FORBIDDEN);

        const response = httpError.getResponse() as Record<string, unknown>;
        expect(response).toHaveProperty('success', false);
        expect(response).toHaveProperty('data', null);
        expect(response).toHaveProperty('message');
        expect(response).toHaveProperty('errorCode', 'SCHOOL_CONTEXT_REQUIRED');
      }
    });

    it('HardConflictDetectedException response matches { success: false, data, message, errorCode }', async () => {
      const conflicts: Conflict[] = [
        {
          type: ConflictType.TEACHER_DOUBLE_BOOKED,
          severity: ConflictSeverity.ERROR,
          message: 'GV trùng lịch',
          details: { teacherId: 'some-id' },
        },
      ];

      const exception = new HardConflictDetectedException(conflicts);
      const response = exception.getResponse() as Record<string, unknown>;

      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty(
        'message',
        'Phát hiện xung đột cứng, không thể lưu',
      );
      expect(response).toHaveProperty('errorCode', 'HARD_CONFLICT_DETECTED');

      // Verify data contains conflicts info
      const data = response['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('conflicts');
      expect(data).toHaveProperty('hasHardConflicts', true);
    });

    it('service exception propagates correctly through controller', async () => {
      const dto: CheckSlotConflictDto = {
        versionId,
        dayOfWeek: 2,
        periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      };

      orchestrationService.checkSingleSlot.mockRejectedValue(
        new HttpException(
          {
            success: false,
            data: null,
            message: 'Không tìm thấy phiên bản thời khóa biểu',
            errorCode: 'VERSION_NOT_FOUND',
          },
          HttpStatus.NOT_FOUND,
        ),
      );

      await expect(
        controller.checkSlot(dto, schoolId, mockUser),
      ).rejects.toThrow(HttpException);

      try {
        await controller.checkSlot(dto, schoolId, mockUser);
      } catch (error) {
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.NOT_FOUND);
        const response = httpError.getResponse() as Record<string, unknown>;
        expect(response).toHaveProperty('success', false);
        expect(response).toHaveProperty('errorCode', 'VERSION_NOT_FOUND');
      }
    });
  });
});
