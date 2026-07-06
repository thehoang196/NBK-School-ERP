import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { TimetableVersionService } from '../../../src/modules/timetable/services/timetable-version.service';
import { TimetablePublishService } from '../../../src/modules/timetable/services/timetable-publish.service';
import {
  ConflictDetectionService,
  ConflictType,
} from '../../../src/modules/timetable/services/conflict-detection.service';
import { TimetableVersionRepository } from '../../../src/modules/timetable/repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../../../src/modules/timetable/repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../../../src/modules/timetable/entities/timetable-version.entity';
import { TimetableSlotEntity } from '../../../src/modules/timetable/entities/timetable-slot.entity';
import { ActualTimetableSlotEntity } from '../../../src/modules/timetable/entities/actual-timetable-slot.entity';
import { TimetablePublishedEvent } from '../../../src/modules/timetable/events/timetable-published.event';
import {
  TimetableVersionStatus,
  SlotStatus,
} from '../../../src/common/enums/status.enum';
import { WeekEntity } from '../../../src/modules/academic/entities/week.entity';
import { WeekType } from '../../../src/modules/academic/enums';

/**
 * Integration test: Timetable Generate → Publish Flow
 *
 * Tests the full service-level flow with mocked repositories:
 * 1. Create version → draft
 * 2. Add manual slots
 * 3. Check conflicts
 * 4. Publish → copies to actual_timetable_slots, archives old, emits event
 */
describe('Timetable Generate → Publish Flow (Integration)', () => {
  let module: TestingModule;
  let versionService: TimetableVersionService;
  let publishService: TimetablePublishService;
  let conflictDetection: ConflictDetectionService;
  let eventEmitter: EventEmitter2;

  // Mock repositories
  let mockVersionRepo: jest.Mocked<TimetableVersionRepository>;
  let mockSlotRepo: jest.Mocked<TimetableSlotRepository>;

  // Mock DataSource
  let mockDataSource: Partial<DataSource>;

  // Shared test data
  const semesterId = 'semester-001';
  const userId = 'user-admin-001';
  const versionId = 'version-001';
  const oldVersionId = 'version-old-001';
  const periodId = 'period-001';
  const classId = 'class-001';
  const teacherId = 'teacher-001';
  const subjectId = 'subject-001';
  const roomId = 'room-001';
  const weekId = 'week-001';

  const createMockVersion = (
    overrides: Partial<TimetableVersionEntity> = {},
  ): TimetableVersionEntity => ({
    id: versionId,
    schoolId: null,
    school: null,
    semesterId,
    name: 'TKB HK1 v1',
    versionNumber: 1,
    status: TimetableVersionStatus.DRAFT,
    effectiveDate: '2024-09-01',
    publishedAt: null,
    publishedBy: null,
    note: null,
    jobId: null,
    generationStartedAt: null,
    generationCompletedAt: null,
    generationDurationMs: null,
    errorMessage: null,
    errorStack: null,
    hasConflicts: false,
    conflictCount: 0,
    conflictDetails: null,
    totalSlots: 0,
    version: 1,
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date('2024-08-01'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    slots: [],
    semester: undefined as never,
    ...overrides,
  });

  const createMockSlot = (
    overrides: Partial<TimetableSlotEntity> = {},
  ): TimetableSlotEntity => ({
    id: 'slot-001',
    versionId,
    schoolId: 'school-001',
    dayOfWeek: 2,
    periodId,
    classId,
    teacherId,
    subjectId,
    roomId,
    isDoublePeriod: false,
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date('2024-08-01'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    timetableVersion: undefined as never,
    period: undefined as never,
    class: undefined as never,
    teacher: undefined as never,
    subject: undefined as never,
    room: undefined as never,
    ...overrides,
  });

  const createMockWeek = (overrides: Partial<WeekEntity> = {}): WeekEntity => ({
    id: weekId,
    schoolId: 'school-001',
    school: undefined as never,
    semesterId,
    weekNumber: 1,
    startDate: '2024-09-02',
    endDate: '2024-09-08',
    note: null,
    weekType: WeekType.REGULAR,
    isHoliday: false,
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date('2024-08-01'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    semester: undefined as never,
    ...overrides,
  });

  // Track transaction operations
  let transactionOperations: {
    updates: Array<{ entity: unknown; criteria: unknown; data: unknown }>;
    softDeletes: Array<{ entity: unknown; criteria: unknown }>;
    saves: Array<{ entity: unknown; data: unknown }>;
    findOnes: Array<{ entity: unknown; where: unknown }>;
  };

  beforeEach(async () => {
    transactionOperations = {
      updates: [],
      softDeletes: [],
      saves: [],
      findOnes: [],
    };

    // Create mock manager for transaction
    const mockManager = {
      update: jest.fn().mockImplementation((entity, criteria, data) => {
        transactionOperations.updates.push({ entity, criteria, data });
        return Promise.resolve();
      }),
      softDelete: jest.fn().mockImplementation((entity, criteria) => {
        transactionOperations.softDeletes.push({ entity, criteria });
        return Promise.resolve();
      }),
      create: jest.fn().mockImplementation((_entity, data) => data),
      save: jest.fn().mockImplementation((_entity, data) => {
        if (Array.isArray(data)) {
          transactionOperations.saves.push({ entity: _entity, data });
          return Promise.resolve(data);
        }
        transactionOperations.saves.push({ entity: _entity, data });
        return Promise.resolve(data);
      }),
      findOne: jest.fn().mockImplementation((_entity, options) => {
        transactionOperations.findOnes.push({
          entity: _entity,
          where: options,
        });
        return Promise.resolve(
          createMockVersion({
            status: TimetableVersionStatus.PUBLISHED,
            publishedAt: new Date(),
            publishedBy: userId,
          }),
        );
      }),
    };

    // Mock DataSource with transaction support and getRepository for weeks
    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: typeof mockManager) => Promise<unknown>) => {
            return cb(mockManager);
          },
        ),
      getRepository: jest.fn().mockImplementation(() => ({
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([createMockWeek()]),
        }),
        findOne: jest.fn().mockResolvedValue(createMockWeek()),
      })),
    } as unknown as DataSource;

    // Mock version repository
    mockVersionRepo = {
      getNextVersionNumber: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(createMockVersion(data))),
      findById: jest.fn().mockResolvedValue(createMockVersion()),
      findPublished: jest.fn().mockResolvedValue(null),
      update: jest
        .fn()
        .mockImplementation((id, data) =>
          Promise.resolve(createMockVersion({ id, ...data })),
        ),
      publish: jest.fn().mockImplementation((id) =>
        Promise.resolve(
          createMockVersion({
            id,
            status: TimetableVersionStatus.PUBLISHED,
            publishedAt: new Date(),
            publishedBy: userId,
          }),
        ),
      ),
      findAll: jest.fn().mockResolvedValue([[], 0]),
      findBySemester: jest.fn().mockResolvedValue([]),
      findByIdWithSlots: jest.fn().mockResolvedValue(null),
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TimetableVersionRepository>;

    // Mock slot repository
    mockSlotRepo = {
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(createMockSlot(data))),
      createMany: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve(
            data.map((d: Partial<TimetableSlotEntity>, i: number) =>
              createMockSlot({ id: `slot-${i}`, ...d }),
            ),
          ),
        ),
      findByVersion: jest.fn().mockResolvedValue([createMockSlot()]),
      findById: jest.fn().mockResolvedValue(createMockSlot()),
      findConflicts: jest.fn().mockResolvedValue([]),
      findByQuery: jest.fn().mockResolvedValue([]),
      findByTeacher: jest.fn().mockResolvedValue([]),
      findByClass: jest.fn().mockResolvedValue([]),
      findByRoom: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(createMockSlot()),
      softDelete: jest.fn().mockResolvedValue(undefined),
      deleteByVersion: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TimetableSlotRepository>;

    // Build the test module
    module = await Test.createTestingModule({
      providers: [
        TimetableVersionService,
        TimetablePublishService,
        ConflictDetectionService,
        EventEmitter2,
        { provide: TimetableVersionRepository, useValue: mockVersionRepo },
        { provide: TimetableSlotRepository, useValue: mockSlotRepo },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: 'TeacherEntityRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: teacherId,
              fullName: 'Nguyễn Văn A',
              maxPeriodsPerDay: 6,
              unavailableSlots: [],
            }),
          },
        },
      ],
    })
      .overrideProvider('TeacherEntityRepository')
      .useValue({
        findOne: jest.fn().mockResolvedValue({
          id: teacherId,
          fullName: 'Nguyễn Văn A',
          maxPeriodsPerDay: 6,
          unavailableSlots: [],
        }),
      })
      .compile();

    versionService = module.get<TimetableVersionService>(
      TimetableVersionService,
    );
    publishService = module.get<TimetablePublishService>(
      TimetablePublishService,
    );
    conflictDetection = module.get<ConflictDetectionService>(
      ConflictDetectionService,
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Full flow', () => {
    it('should create version, add slots, and publish successfully', async () => {
      // Step 1: Create a new draft version
      const version = await versionService.create({
        semesterId,
        name: 'TKB HK1 v1',
        effectiveDate: '2024-09-01',
      });

      expect(version).toBeDefined();
      expect(version.status).toBe(TimetableVersionStatus.DRAFT);
      expect(version.semesterId).toBe(semesterId);
      expect(mockVersionRepo.getNextVersionNumber).toHaveBeenCalledWith(
        semesterId,
      );
      expect(mockVersionRepo.create).toHaveBeenCalled();

      // Step 2: Add manual slots (simulate slots being created)
      const slot = await mockSlotRepo.create({
        versionId: version.id,
        dayOfWeek: 2,
        periodId,
        classId,
        teacherId,
        subjectId,
        roomId,
        isDoublePeriod: false,
      });

      expect(slot).toBeDefined();
      expect(slot.versionId).toBe(version.id);

      // Step 3: Check conflicts - no conflicts expected
      const conflicts = await conflictDetection.checkAllConflicts(version.id);
      expect(conflicts).toEqual([]);

      // Step 4: Publish the version
      // Configure mock to return slots for publish
      mockSlotRepo.findByVersion.mockResolvedValue([
        createMockSlot({ versionId: version.id }),
      ]);
      mockVersionRepo.findById.mockResolvedValue(
        createMockVersion({ id: version.id }),
      );

      // Track event emission
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      const result = await publishService.publish(version.id, userId);

      // Verify publish result
      expect(result).toBeDefined();
      expect(result.version.status).toBe(TimetableVersionStatus.PUBLISHED);
      expect(result.slotsPublished).toBeGreaterThan(0);
      expect(result.weeksAffected).toBe(1);

      // Verify old version was archived (in the transaction)
      const archiveUpdate = transactionOperations.updates.find(
        (u) =>
          u.data &&
          (u.data as Record<string, unknown>).status ===
            TimetableVersionStatus.ARCHIVED,
      );
      expect(archiveUpdate).toBeDefined();

      // Verify actual timetable slots were created
      expect(transactionOperations.saves.length).toBeGreaterThan(0);

      // Verify event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        TimetablePublishedEvent.eventName,
        expect.objectContaining({
          versionId: version.id,
          semesterId,
          teacherIds: [teacherId],
          publishedBy: userId,
        }),
      );
    });

    it('should fail to publish if conflicts exist', async () => {
      // Set up a version with conflicting slots
      const conflictingSlots = [
        createMockSlot({ id: 'slot-1', teacherId, dayOfWeek: 2, periodId }),
        createMockSlot({
          id: 'slot-2',
          teacherId,
          dayOfWeek: 2,
          periodId,
          classId: 'class-002',
        }),
      ];

      // Mock findByVersion to return conflicting slots (same teacher, same time, different class)
      mockSlotRepo.findByVersion.mockResolvedValue(conflictingSlots);

      // Check conflicts - should detect teacher conflict
      const conflicts = await conflictDetection.checkAllConflicts(versionId);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(
        conflicts.some((c) => c.type === ConflictType.TEACHER_CONFLICT),
      ).toBe(true);
      expect(conflicts.some((c) => c.severity === 'error')).toBe(true);

      // Attempt to publish should fail because conflicts exist
      await expect(publishService.publish(versionId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should archive previous published version on new publish', async () => {
      // Setup: an existing published version exists for the same semester
      const oldPublishedVersion = createMockVersion({
        id: oldVersionId,
        versionNumber: 1,
        status: TimetableVersionStatus.PUBLISHED,
        publishedAt: new Date('2024-08-15'),
        publishedBy: 'user-prev',
      });

      // Current version is a new draft to be published
      const newDraftVersion = createMockVersion({
        id: versionId,
        versionNumber: 2,
        status: TimetableVersionStatus.DRAFT,
      });

      mockVersionRepo.findById.mockResolvedValue(newDraftVersion);
      mockVersionRepo.findPublished.mockResolvedValue(oldPublishedVersion);

      // No conflicts
      mockSlotRepo.findByVersion.mockResolvedValue([createMockSlot()]);

      const result = await publishService.publish(versionId, userId);

      expect(result).toBeDefined();
      expect(result.version.status).toBe(TimetableVersionStatus.PUBLISHED);

      // Verify the old version was archived inside the transaction
      const archiveUpdates = transactionOperations.updates.filter(
        (u) =>
          u.data &&
          (u.data as Record<string, unknown>).status ===
            TimetableVersionStatus.ARCHIVED,
      );
      expect(archiveUpdates.length).toBeGreaterThan(0);

      // The archive should target published versions of the same semester
      const archiveOp = archiveUpdates[0];
      expect(archiveOp.criteria).toEqual({
        semesterId,
        status: TimetableVersionStatus.PUBLISHED,
      });
    });

    it('should copy slots to actual_timetable_slots for non-holiday weeks', async () => {
      const weeks = [
        createMockWeek({
          id: 'week-1',
          weekNumber: 1,
          weekType: WeekType.REGULAR,
        }),
        createMockWeek({
          id: 'week-2',
          weekNumber: 2,
          weekType: WeekType.HOLIDAY,
        }),
        createMockWeek({
          id: 'week-3',
          weekNumber: 3,
          weekType: WeekType.REGULAR,
        }),
      ];

      // Override getRepository to return these weeks
      (mockDataSource as { getRepository: jest.Mock }).getRepository = jest
        .fn()
        .mockImplementation(() => ({
          createQueryBuilder: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(weeks),
          }),
          findOne: jest.fn().mockResolvedValue(null),
        }));

      const slots = [createMockSlot()];
      mockSlotRepo.findByVersion.mockResolvedValue(slots);
      mockVersionRepo.findById.mockResolvedValue(createMockVersion());

      const result = await publishService.publish(versionId, userId);

      // 2 non-holiday weeks × 1 slot = 2 actual slots should be created
      expect(result.slotsPublished).toBe(2);
      expect(result.weeksAffected).toBe(2);
    });

    it('should emit TimetablePublishedEvent with correct teacher list', async () => {
      const slotsWithMultipleTeachers = [
        createMockSlot({ id: 'slot-1', teacherId: 'teacher-001' }),
        createMockSlot({
          id: 'slot-2',
          teacherId: 'teacher-002',
          classId: 'class-002',
          dayOfWeek: 3,
        }),
        createMockSlot({
          id: 'slot-3',
          teacherId: 'teacher-001',
          classId: 'class-003',
          dayOfWeek: 4,
        }),
      ];

      mockSlotRepo.findByVersion.mockResolvedValue(slotsWithMultipleTeachers);
      mockVersionRepo.findById.mockResolvedValue(createMockVersion());

      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await publishService.publish(versionId, userId);

      expect(emitSpy).toHaveBeenCalledWith(
        TimetablePublishedEvent.eventName,
        expect.objectContaining({
          versionId,
          semesterId,
          teacherIds: expect.arrayContaining(['teacher-001', 'teacher-002']),
          publishedBy: userId,
        }),
      );

      // Verify uniqueness - teacher-001 appears twice in slots but only once in event
      const emittedEvent = emitSpy.mock.calls[0][1] as TimetablePublishedEvent;
      expect(emittedEvent.teacherIds).toHaveLength(2);
    });

    it('should fail to publish version with no slots', async () => {
      mockSlotRepo.findByVersion.mockResolvedValue([]);
      mockVersionRepo.findById.mockResolvedValue(createMockVersion());

      await expect(publishService.publish(versionId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fail to publish already published version', async () => {
      mockVersionRepo.findById.mockResolvedValue(
        createMockVersion({ status: TimetableVersionStatus.PUBLISHED }),
      );

      await expect(publishService.publish(versionId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
