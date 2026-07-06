import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TimetablePublishService } from './timetable-publish.service';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { ConflictDetectionService } from './conflict-detection.service';
import { TimetablePublishedEvent } from '../events/timetable-published.event';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';

describe('TimetablePublishService', () => {
  let service: TimetablePublishService;
  let versionRepo: jest.Mocked<TimetableVersionRepository>;
  let slotRepo: jest.Mocked<TimetableSlotRepository>;
  let conflictDetection: jest.Mocked<ConflictDetectionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let dataSource: jest.Mocked<DataSource>;

  const mockVersion = {
    id: 'version-1',
    semesterId: 'semester-1',
    name: 'TKB v1',
    versionNumber: 1,
    status: TimetableVersionStatus.DRAFT,
    publishedAt: null,
    publishedBy: null,
  };

  const mockSlots = [
    {
      teacherId: 'teacher-1',
      dayOfWeek: 2,
      periodId: 'p1',
      classId: 'c1',
      subjectId: 's1',
      roomId: 'r1',
    },
    {
      teacherId: 'teacher-2',
      dayOfWeek: 3,
      periodId: 'p2',
      classId: 'c2',
      subjectId: 's2',
      roomId: 'r2',
    },
    {
      teacherId: 'teacher-1',
      dayOfWeek: 4,
      periodId: 'p3',
      classId: 'c3',
      subjectId: 's3',
      roomId: 'r3',
    },
  ];

  const mockWeeks = [
    { id: 'week-1', weekNumber: 1, isHoliday: false },
    { id: 'week-2', weekNumber: 2, isHoliday: false },
  ];

  beforeEach(async () => {
    const mockManager = {
      update: jest.fn(),
      softDelete: jest.fn(),
      create: jest.fn().mockImplementation((_entity, data) => data),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        ...mockVersion,
        status: TimetableVersionStatus.PUBLISHED,
      }),
    };

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockWeeks),
    };

    const mockWeekRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
      getRepository: jest.fn().mockReturnValue(mockWeekRepo),
    } as unknown as jest.Mocked<DataSource>;

    versionRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<TimetableVersionRepository>;

    slotRepo = {
      findByVersion: jest.fn(),
    } as unknown as jest.Mocked<TimetableSlotRepository>;

    conflictDetection = {
      checkAllConflicts: jest.fn(),
    } as unknown as jest.Mocked<ConflictDetectionService>;

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetablePublishService,
        { provide: DataSource, useValue: dataSource },
        { provide: TimetableVersionRepository, useValue: versionRepo },
        { provide: TimetableSlotRepository, useValue: slotRepo },
        { provide: ConflictDetectionService, useValue: conflictDetection },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<TimetablePublishService>(TimetablePublishService);
  });

  describe('publish - event emission', () => {
    beforeEach(() => {
      versionRepo.findById.mockResolvedValue(mockVersion as never);
      slotRepo.findByVersion.mockResolvedValue(mockSlots as never);
      conflictDetection.checkAllConflicts.mockResolvedValue([]);
    });

    it('should emit TimetablePublishedEvent after successful publish', async () => {
      await service.publish('version-1', 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        TimetablePublishedEvent.eventName,
        expect.any(TimetablePublishedEvent),
      );
    });

    it('should emit event with unique teacherIds from slots', async () => {
      await service.publish('version-1', 'user-1');

      const emittedEvent = eventEmitter.emit.mock
        .calls[0][1] as TimetablePublishedEvent;
      // teacher-1 appears twice in mockSlots, should be deduplicated
      expect(emittedEvent.teacherIds).toHaveLength(2);
      expect(emittedEvent.teacherIds).toContain('teacher-1');
      expect(emittedEvent.teacherIds).toContain('teacher-2');
    });

    it('should emit event with correct versionId and semesterId', async () => {
      await service.publish('version-1', 'user-1');

      const emittedEvent = eventEmitter.emit.mock
        .calls[0][1] as TimetablePublishedEvent;
      expect(emittedEvent.versionId).toBe('version-1');
      expect(emittedEvent.semesterId).toBe('semester-1');
      expect(emittedEvent.publishedBy).toBe('user-1');
    });

    it('should emit event with publishedAt date', async () => {
      const before = new Date();
      await service.publish('version-1', 'user-1');
      const after = new Date();

      const emittedEvent = eventEmitter.emit.mock
        .calls[0][1] as TimetablePublishedEvent;
      expect(emittedEvent.publishedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(emittedEvent.publishedAt.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });

    it('should not throw if event emission fails', async () => {
      eventEmitter.emit.mockImplementation(() => {
        throw new Error('EventEmitter failure');
      });

      // Should not throw - publish should still succeed
      const result = await service.publish('version-1', 'user-1');
      expect(result).toBeDefined();
    });

    it('should NOT emit event if version is not found', async () => {
      versionRepo.findById.mockResolvedValue(null as never);

      await expect(service.publish('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should NOT emit event if version is already published', async () => {
      versionRepo.findById.mockResolvedValue({
        ...mockVersion,
        status: TimetableVersionStatus.PUBLISHED,
      } as never);

      await expect(service.publish('version-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should NOT emit event if there are unresolved conflicts', async () => {
      conflictDetection.checkAllConflicts.mockResolvedValue([
        { severity: 'error', type: 'teacher_conflict', message: 'conflict' },
      ] as never);

      await expect(service.publish('version-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
