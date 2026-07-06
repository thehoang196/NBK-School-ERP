import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TimetableSlotService } from '../../../src/modules/timetable/services/timetable-slot.service';
import { TimetableSlotRepository } from '../../../src/modules/timetable/repositories/timetable-slot.repository';
import {
  ConflictDetectionService,
  ConflictType,
  ConflictResult,
} from '../../../src/modules/timetable/services/conflict-detection.service';
import { ConflictOrchestrationService } from '../../../src/modules/timetable/services/conflict-orchestration.service';
import {
  HardConflictDetectedException,
  SoftConflictRequiresOverrideException,
} from '../../../src/modules/timetable/exceptions/conflict.exception';
import { ConflictCheckResult } from '../../../src/modules/timetable/interfaces/conflict.interface';
import { ConflictSeverity } from '../../../src/modules/timetable/enums/conflict.enum';
import { TimetableSlotEntity } from '../../../src/modules/timetable/entities/timetable-slot.entity';
import { CreateTimetableSlotDto } from '../../../src/modules/timetable/dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from '../../../src/modules/timetable/dto/update-timetable-slot.dto';
import { CheckConflictsDto } from '../../../src/modules/timetable/dto/check-conflicts.dto';

describe('TimetableSlotService', () => {
  let service: TimetableSlotService;
  let slotRepo: jest.Mocked<TimetableSlotRepository>;
  let conflictDetectionService: jest.Mocked<ConflictDetectionService>;
  let conflictOrchestrationService: jest.Mocked<ConflictOrchestrationService>;

  const schoolId = '99999999-9999-9999-9999-999999999999';
  const userId = '88888888-8888-8888-8888-888888888888';

  const mockSlot: TimetableSlotEntity = {
    id: '11111111-1111-1111-1111-111111111111',
    versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    schoolId: '99999999-9999-9999-9999-999999999999',
    version: {} as TimetableSlotEntity['version'],
    dayOfWeek: 2,
    periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    period: {} as TimetableSlotEntity['period'],
    classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    class: {} as TimetableSlotEntity['class'],
    teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    teacher: {} as TimetableSlotEntity['teacher'],
    subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    subject: {} as TimetableSlotEntity['subject'],
    roomId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    room: {} as TimetableSlotEntity['room'],
    isDoublePeriod: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
  };

  const noConflictsResult: ConflictCheckResult = {
    hasHardConflicts: false,
    hasSoftConflicts: false,
    conflicts: [],
    hardCount: 0,
    softCount: 0,
  };

  beforeEach(async () => {
    const mockSlotRepo = {
      findById: jest.fn(),
      findByVersion: jest.fn(),
      findConflicts: jest.fn(),
      findByQuery: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockConflictDetectionService = {
      checkSlotConflicts: jest.fn(),
      checkAllConflicts: jest.fn(),
      detectConflicts: jest.fn(),
      buildIndexes: jest.fn(),
    };

    const mockConflictOrchestrationService = {
      checkSingleSlot: jest.fn(),
      checkFullVersion: jest.fn(),
      checkBatch: jest.fn(),
      overrideSoftConflicts: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableSlotService,
        { provide: TimetableSlotRepository, useValue: mockSlotRepo },
        {
          provide: ConflictDetectionService,
          useValue: mockConflictDetectionService,
        },
        {
          provide: ConflictOrchestrationService,
          useValue: mockConflictOrchestrationService,
        },
      ],
    }).compile();

    service = module.get<TimetableSlotService>(TimetableSlotService);
    slotRepo = module.get(TimetableSlotRepository);
    conflictDetectionService = module.get(ConflictDetectionService);
    conflictOrchestrationService = module.get(ConflictOrchestrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // === CREATE ===
  describe('create()', () => {
    const createDto: CreateTimetableSlotDto = {
      versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      dayOfWeek: 2,
      periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      subjectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      roomId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      isDoublePeriod: false,
    };

    it('should create slot when no conflicts exist', async () => {
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        noConflictsResult,
      );
      slotRepo.create.mockResolvedValue(mockSlot);

      const result = await service.create(createDto, schoolId, userId);

      expect(conflictOrchestrationService.checkSingleSlot).toHaveBeenCalledWith(
        {
          versionId: createDto.versionId,
          dayOfWeek: createDto.dayOfWeek,
          periodId: createDto.periodId,
          teacherId: createDto.teacherId,
          classId: createDto.classId,
          roomId: createDto.roomId,
          subjectId: createDto.subjectId,
        },
        schoolId,
        userId,
      );
      expect(slotRepo.create).toHaveBeenCalledWith({
        versionId: createDto.versionId,
        dayOfWeek: createDto.dayOfWeek,
        periodId: createDto.periodId,
        classId: createDto.classId,
        teacherId: createDto.teacherId,
        subjectId: createDto.subjectId,
        roomId: createDto.roomId,
        isDoublePeriod: false,
      });
      expect(result).toEqual(mockSlot);
    });

    it('should throw HardConflictDetectedException when hard conflicts exist', async () => {
      const hardConflictResult: ConflictCheckResult = {
        hasHardConflicts: true,
        hasSoftConflicts: false,
        conflicts: [
          {
            type: 'TEACHER_DOUBLE_BOOKED' as never,
            severity: ConflictSeverity.ERROR,
            message: 'GV đã có tiết dạy',
            details: { teacherId: createDto.teacherId },
          },
        ],
        hardCount: 1,
        softCount: 0,
      };
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        hardConflictResult,
      );

      await expect(service.create(createDto, schoolId, userId)).rejects.toThrow(
        HardConflictDetectedException,
      );
    });

    it('should throw SoftConflictRequiresOverrideException when soft conflicts exist without override', async () => {
      const softConflictResult: ConflictCheckResult = {
        hasHardConflicts: false,
        hasSoftConflicts: true,
        conflicts: [
          {
            type: 'TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED' as never,
            severity: ConflictSeverity.WARNING,
            message: 'GV quá tải',
            details: {
              teacherId: createDto.teacherId,
              currentCount: 5,
              maxAllowed: 4,
            },
          },
        ],
        hardCount: 0,
        softCount: 1,
      };
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        softConflictResult,
      );

      await expect(service.create(createDto, schoolId, userId)).rejects.toThrow(
        SoftConflictRequiresOverrideException,
      );
    });

    it('should proceed when soft conflicts exist with valid override', async () => {
      const softConflictResult: ConflictCheckResult = {
        hasHardConflicts: false,
        hasSoftConflicts: true,
        conflicts: [
          {
            type: 'TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED' as never,
            severity: ConflictSeverity.WARNING,
            message: 'GV quá tải',
            details: {
              teacherId: createDto.teacherId,
              currentCount: 5,
              maxAllowed: 4,
            },
          },
        ],
        hardCount: 0,
        softCount: 1,
      };
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        softConflictResult,
      );
      slotRepo.create.mockResolvedValue(mockSlot);

      const override = { reason: 'GV đồng ý dạy thêm tiết theo yêu cầu' };
      const result = await service.create(
        createDto,
        schoolId,
        userId,
        override,
      );

      expect(slotRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockSlot);
    });

    it('should handle roomId as null when not provided', async () => {
      const dtoNoRoom: CreateTimetableSlotDto = {
        ...createDto,
        roomId: undefined,
      };
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        noConflictsResult,
      );
      slotRepo.create.mockResolvedValue({ ...mockSlot, roomId: null });

      await service.create(dtoNoRoom, schoolId, userId);

      expect(conflictOrchestrationService.checkSingleSlot).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: undefined }),
        schoolId,
        userId,
      );
      expect(slotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: null }),
      );
    });
  });

  // === FIND BY VERSION ===
  describe('findByVersion()', () => {
    it('should return all slots for a version', async () => {
      const slots = [
        mockSlot,
        { ...mockSlot, id: '22222222-2222-2222-2222-222222222222' },
      ];
      slotRepo.findByVersion.mockResolvedValue(slots);

      const result = await service.findByVersion(mockSlot.versionId);

      expect(slotRepo.findByVersion).toHaveBeenCalledWith(mockSlot.versionId);
      expect(result).toEqual(slots);
    });

    it('should return empty array when no slots exist', async () => {
      slotRepo.findByVersion.mockResolvedValue([]);

      const result = await service.findByVersion('non-existent-version');

      expect(result).toEqual([]);
    });
  });

  // === FIND BY ID ===
  describe('findById()', () => {
    it('should return slot when found', async () => {
      slotRepo.findById.mockResolvedValue(mockSlot);

      const result = await service.findById(mockSlot.id);

      expect(slotRepo.findById).toHaveBeenCalledWith(mockSlot.id);
      expect(result).toEqual(mockSlot);
    });

    it('should throw NotFoundException when slot not found', async () => {
      slotRepo.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        'Không tìm thấy slot TKB',
      );
    });
  });

  // === UPDATE ===
  describe('update()', () => {
    const updateDto: UpdateTimetableSlotDto = {
      dayOfWeek: 3,
      periodId: 'new-period-id',
      teacherId: 'new-teacher-id',
    };

    it('should update slot when no conflicts exist', async () => {
      const updatedSlot = { ...mockSlot, dayOfWeek: 3 };
      slotRepo.findById.mockResolvedValue(mockSlot);
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        noConflictsResult,
      );
      slotRepo.update.mockResolvedValue(updatedSlot);

      const result = await service.update(
        mockSlot.id,
        updateDto,
        schoolId,
        userId,
      );

      expect(conflictOrchestrationService.checkSingleSlot).toHaveBeenCalledWith(
        {
          versionId: mockSlot.versionId,
          dayOfWeek: updateDto.dayOfWeek,
          periodId: updateDto.periodId,
          teacherId: updateDto.teacherId,
          classId: mockSlot.classId,
          roomId: mockSlot.roomId,
          subjectId: mockSlot.subjectId,
          excludeSlotId: mockSlot.id,
        },
        schoolId,
        userId,
      );
      expect(slotRepo.update).toHaveBeenCalledWith(mockSlot.id, {
        dayOfWeek: 3,
        periodId: 'new-period-id',
        teacherId: 'new-teacher-id',
      });
      expect(result).toEqual(updatedSlot);
    });

    it('should throw NotFoundException if slot does not exist', async () => {
      slotRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', updateDto, schoolId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw HardConflictDetectedException on hard conflicts', async () => {
      const hardConflictResult: ConflictCheckResult = {
        hasHardConflicts: true,
        hasSoftConflicts: false,
        conflicts: [
          {
            type: 'ROOM_DOUBLE_BOOKED' as never,
            severity: ConflictSeverity.ERROR,
            message: 'Phòng học đã được sử dụng',
            details: { roomId: mockSlot.roomId! },
          },
        ],
        hardCount: 1,
        softCount: 0,
      };
      slotRepo.findById.mockResolvedValue(mockSlot);
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        hardConflictResult,
      );

      await expect(
        service.update(mockSlot.id, updateDto, schoolId, userId),
      ).rejects.toThrow(HardConflictDetectedException);
    });

    it('should use existing slot values for unset fields in conflict check', async () => {
      const partialUpdate: UpdateTimetableSlotDto = { roomId: 'new-room-id' };
      slotRepo.findById.mockResolvedValue(mockSlot);
      conflictOrchestrationService.checkSingleSlot.mockResolvedValue(
        noConflictsResult,
      );
      slotRepo.update.mockResolvedValue({ ...mockSlot, roomId: 'new-room-id' });

      await service.update(mockSlot.id, partialUpdate, schoolId, userId);

      expect(conflictOrchestrationService.checkSingleSlot).toHaveBeenCalledWith(
        {
          versionId: mockSlot.versionId,
          dayOfWeek: mockSlot.dayOfWeek,
          periodId: mockSlot.periodId,
          teacherId: mockSlot.teacherId,
          classId: mockSlot.classId,
          roomId: 'new-room-id',
          subjectId: mockSlot.subjectId,
          excludeSlotId: mockSlot.id,
        },
        schoolId,
        userId,
      );
    });
  });

  // === DELETE ===
  describe('delete()', () => {
    it('should soft-delete slot when it exists', async () => {
      slotRepo.findById.mockResolvedValue(mockSlot);
      slotRepo.softDelete.mockResolvedValue(undefined);

      await service.delete(mockSlot.id);

      expect(slotRepo.findById).toHaveBeenCalledWith(mockSlot.id);
      expect(slotRepo.softDelete).toHaveBeenCalledWith(mockSlot.id);
    });

    it('should throw NotFoundException if slot not found', async () => {
      slotRepo.findById.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // === CHECK CONFLICTS (legacy) ===
  describe('checkConflicts()', () => {
    it('should delegate to conflict detection service', async () => {
      const dto: CheckConflictsDto = {
        versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        dayOfWeek: 2,
        periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        roomId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      };

      const expectedConflicts: ConflictResult[] = [
        {
          type: ConflictType.TEACHER_CONFLICT,
          severity: 'error',
          message: 'Giáo viên đã có tiết dạy vào thời điểm này',
          details: {
            teacherId: dto.teacherId,
            dayOfWeek: 2,
            periodId: dto.periodId,
          },
        },
      ];
      conflictDetectionService.checkSlotConflicts.mockResolvedValue(
        expectedConflicts,
      );

      const result = await service.checkConflicts(dto);

      expect(conflictDetectionService.checkSlotConflicts).toHaveBeenCalledWith(
        dto.versionId,
        dto.dayOfWeek,
        dto.periodId,
        dto.teacherId,
        dto.classId,
        dto.roomId,
        undefined,
      );
      expect(result).toEqual(expectedConflicts);
    });

    it('should pass excludeSlotId when provided', async () => {
      const dto: CheckConflictsDto = {
        versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        dayOfWeek: 2,
        periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        excludeSlotId: '11111111-1111-1111-1111-111111111111',
      };

      conflictDetectionService.checkSlotConflicts.mockResolvedValue([]);

      await service.checkConflicts(dto);

      expect(conflictDetectionService.checkSlotConflicts).toHaveBeenCalledWith(
        dto.versionId,
        dto.dayOfWeek,
        dto.periodId,
        dto.teacherId,
        dto.classId,
        null,
        dto.excludeSlotId,
      );
    });

    it('should return empty array when no conflicts found', async () => {
      const dto: CheckConflictsDto = {
        versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        dayOfWeek: 5,
        periodId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        teacherId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      };

      conflictDetectionService.checkSlotConflicts.mockResolvedValue([]);

      const result = await service.checkConflicts(dto);

      expect(result).toEqual([]);
    });
  });
});
