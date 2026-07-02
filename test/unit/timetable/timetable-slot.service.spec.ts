import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TimetableSlotService } from '../../../src/modules/timetable/services/timetable-slot.service';
import { TimetableSlotRepository } from '../../../src/modules/timetable/repositories/timetable-slot.repository';
import { ConflictDetectionService, ConflictType, ConflictResult } from '../../../src/modules/timetable/services/conflict-detection.service';
import { TimetableSlotEntity } from '../../../src/modules/timetable/entities/timetable-slot.entity';
import { CreateTimetableSlotDto } from '../../../src/modules/timetable/dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from '../../../src/modules/timetable/dto/update-timetable-slot.dto';
import { CheckConflictsDto } from '../../../src/modules/timetable/dto/check-conflicts.dto';

describe('TimetableSlotService', () => {
  let service: TimetableSlotService;
  let slotRepo: jest.Mocked<TimetableSlotRepository>;
  let conflictService: jest.Mocked<ConflictDetectionService>;

  const mockSlot: TimetableSlotEntity = {
    id: '11111111-1111-1111-1111-111111111111',
    versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
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

    const mockConflictService = {
      checkSlotConflicts: jest.fn(),
      checkAllConflicts: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableSlotService,
        { provide: TimetableSlotRepository, useValue: mockSlotRepo },
        { provide: ConflictDetectionService, useValue: mockConflictService },
      ],
    }).compile();

    service = module.get<TimetableSlotService>(TimetableSlotService);
    slotRepo = module.get(TimetableSlotRepository);
    conflictService = module.get(ConflictDetectionService);
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
      conflictService.checkSlotConflicts.mockResolvedValue([]);
      slotRepo.create.mockResolvedValue(mockSlot);

      const result = await service.create(createDto);

      expect(conflictService.checkSlotConflicts).toHaveBeenCalledWith(
        createDto.versionId,
        createDto.dayOfWeek,
        createDto.periodId,
        createDto.teacherId,
        createDto.classId,
        createDto.roomId,
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

    it('should create slot when only warning-level conflicts exist', async () => {
      const warningConflict: ConflictResult = {
        type: ConflictType.TEACHER_MAX_PERIODS,
        severity: 'warning',
        message: 'Giáo viên đã đạt số tiết tối đa/ngày',
        details: { teacherId: createDto.teacherId, dayOfWeek: 2 },
      };
      conflictService.checkSlotConflicts.mockResolvedValue([warningConflict]);
      slotRepo.create.mockResolvedValue(mockSlot);

      const result = await service.create(createDto);

      expect(slotRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockSlot);
    });

    it('should throw BadRequestException when error-level conflicts exist', async () => {
      const errorConflict: ConflictResult = {
        type: ConflictType.TEACHER_CONFLICT,
        severity: 'error',
        message: 'Giáo viên đã có tiết dạy vào thời điểm này',
        details: { slotId: 'existing-slot', teacherId: createDto.teacherId, dayOfWeek: 2, periodId: createDto.periodId },
      };
      conflictService.checkSlotConflicts.mockResolvedValue([errorConflict]);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle roomId as null when not provided', async () => {
      const dtoNoRoom: CreateTimetableSlotDto = { ...createDto, roomId: undefined };
      conflictService.checkSlotConflicts.mockResolvedValue([]);
      slotRepo.create.mockResolvedValue({ ...mockSlot, roomId: null });

      await service.create(dtoNoRoom);

      expect(conflictService.checkSlotConflicts).toHaveBeenCalledWith(
        dtoNoRoom.versionId,
        dtoNoRoom.dayOfWeek,
        dtoNoRoom.periodId,
        dtoNoRoom.teacherId,
        dtoNoRoom.classId,
        null,
      );
      expect(slotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: null }),
      );
    });
  });

  // === FIND BY VERSION ===
  describe('findByVersion()', () => {
    it('should return all slots for a version', async () => {
      const slots = [mockSlot, { ...mockSlot, id: '22222222-2222-2222-2222-222222222222' }];
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

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toThrow('Không tìm thấy slot TKB');
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
      conflictService.checkSlotConflicts.mockResolvedValue([]);
      slotRepo.update.mockResolvedValue(updatedSlot);

      const result = await service.update(mockSlot.id, updateDto);

      expect(conflictService.checkSlotConflicts).toHaveBeenCalledWith(
        mockSlot.versionId,
        updateDto.dayOfWeek,
        updateDto.periodId,
        updateDto.teacherId,
        mockSlot.classId,
        mockSlot.roomId,
        mockSlot.id, // excludeSlotId
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

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on error-level conflicts', async () => {
      const errorConflict: ConflictResult = {
        type: ConflictType.ROOM_CONFLICT,
        severity: 'error',
        message: 'Phòng học đã được sử dụng vào thời điểm này',
        details: { roomId: mockSlot.roomId!, dayOfWeek: 3, periodId: 'new-period-id' },
      };
      slotRepo.findById.mockResolvedValue(mockSlot);
      conflictService.checkSlotConflicts.mockResolvedValue([errorConflict]);

      await expect(service.update(mockSlot.id, updateDto)).rejects.toThrow(BadRequestException);
    });

    it('should use existing slot values for unset fields in conflict check', async () => {
      const partialUpdate: UpdateTimetableSlotDto = { roomId: 'new-room-id' };
      slotRepo.findById.mockResolvedValue(mockSlot);
      conflictService.checkSlotConflicts.mockResolvedValue([]);
      slotRepo.update.mockResolvedValue({ ...mockSlot, roomId: 'new-room-id' });

      await service.update(mockSlot.id, partialUpdate);

      expect(conflictService.checkSlotConflicts).toHaveBeenCalledWith(
        mockSlot.versionId,
        mockSlot.dayOfWeek, // from existing
        mockSlot.periodId,  // from existing
        mockSlot.teacherId, // from existing
        mockSlot.classId,   // from existing
        'new-room-id',      // from dto
        mockSlot.id,
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

      await expect(service.delete('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // === CHECK CONFLICTS ===
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
          details: { teacherId: dto.teacherId, dayOfWeek: 2, periodId: dto.periodId },
        },
      ];
      conflictService.checkSlotConflicts.mockResolvedValue(expectedConflicts);

      const result = await service.checkConflicts(dto);

      expect(conflictService.checkSlotConflicts).toHaveBeenCalledWith(
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

      conflictService.checkSlotConflicts.mockResolvedValue([]);

      await service.checkConflicts(dto);

      expect(conflictService.checkSlotConflicts).toHaveBeenCalledWith(
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

      conflictService.checkSlotConflicts.mockResolvedValue([]);

      const result = await service.checkConflicts(dto);

      expect(result).toEqual([]);
    });
  });
});
