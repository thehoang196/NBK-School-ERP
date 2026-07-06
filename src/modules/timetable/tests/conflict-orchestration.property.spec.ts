/**
 * Feature: conflict-detection, Property 12, 13, 14, 17: Orchestration Logic
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 10.1, 10.4**
 *
 * Tests the orchestration rules:
 * - Property 12: Hard constraints always block save (override cannot bypass ERROR severity)
 * - Property 13: Soft constraints — override with valid reason (≥10 chars) allows proceed
 * - Property 14: Override creates audit log (updateOverride called for each log)
 * - Property 17: Intra-batch conflict detection (two batch slots sharing timeslot+resource)
 *
 * For Properties 12, 13, 14: We test ConflictOrchestrationService.overrideSoftConflicts
 * with mocked ConflictLogRepository.
 *
 * For Property 17: We test via ConflictDetectionService.buildIndexes + detectConflicts
 * using real checker logic (pure function approach).
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConflictOrchestrationService } from '../services/conflict-orchestration.service';
import { ConflictDetectionService } from '../services/conflict-detection.service';
import { ConflictSlotRepository } from '../repositories/conflict-slot.repository';
import { ConflictLogRepository } from '../repositories/conflict-log.repository';
import { TeacherDoubleBookedChecker } from '../services/checkers/teacher-double-booked.checker';
import { RoomDoubleBookedChecker } from '../services/checkers/room-double-booked.checker';
import { ClassDoubleBookedChecker } from '../services/checkers/class-double-booked.checker';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import { SlotCheckPayload } from '../interfaces/conflict.interface';
import {
  ConflictSeverity,
  ConflictType,
  ConflictLogStatus,
  ValidationContext,
} from '../enums/conflict.enum';
import type { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import type { ConflictLogEntity } from '../entities/conflict-log.entity';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();
const dayOfWeekArb = fc.integer({ min: 2, max: 7 });

/**
 * Generate a valid override reason (≥10 characters).
 */
const validReasonArb = fc
  .string({ minLength: 10, maxLength: 200 })
  .filter((s) => s.trim().length >= 10);

/**
 * Generate an invalid override reason (<10 characters).
 */
const invalidReasonArb = fc.string({ minLength: 0, maxLength: 9 });

/**
 * Generate a mock ConflictLogEntity with severity WARNING.
 */
const warningLogArb: fc.Arbitrary<Partial<ConflictLogEntity>> = fc.record({
  id: uuidArb,
  severity: fc.constant(
    ConflictSeverity.WARNING,
  ) as fc.Arbitrary<ConflictSeverity>,
  conflictType: fc.constantFrom(
    ConflictType.TEACHER_MAX_CONSECUTIVE_EXCEEDED,
    ConflictType.TEACHER_INSUFFICIENT_TRAVEL_TIME,
    ConflictType.SUBJECT_CONSECUTIVE_DAYS,
    ConflictType.TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED,
  ) as fc.Arbitrary<ConflictType>,
  status: fc.constant(
    ConflictLogStatus.DETECTED,
  ) as fc.Arbitrary<ConflictLogStatus>,
});

/**
 * Generate a mock ConflictLogEntity with severity ERROR.
 */
const errorLogArb: fc.Arbitrary<Partial<ConflictLogEntity>> = fc.record({
  id: uuidArb,
  severity: fc.constant(
    ConflictSeverity.ERROR,
  ) as fc.Arbitrary<ConflictSeverity>,
  conflictType: fc.constantFrom(
    ConflictType.TEACHER_DOUBLE_BOOKED,
    ConflictType.ROOM_DOUBLE_BOOKED,
    ConflictType.CLASS_DOUBLE_BOOKED,
  ) as fc.Arbitrary<ConflictType>,
  status: fc.constant(
    ConflictLogStatus.DETECTED,
  ) as fc.Arbitrary<ConflictLogStatus>,
});

/**
 * Generate a SlotCheckPayload with all required fields.
 */
const slotPayloadArb: fc.Arbitrary<SlotCheckPayload> = fc.record({
  versionId: uuidArb,
  dayOfWeek: dayOfWeekArb,
  periodId: uuidArb,
  teacherId: uuidArb,
  classId: uuidArb,
  roomId: fc.option(uuidArb, { nil: null }) as fc.Arbitrary<string | null>,
  subjectId: uuidArb,
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: conflict-detection, Orchestration Logic', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties 12, 13, 14 — Override logic
  // Uses mocked repositories since these test orchestration validation rules.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Override Logic (Properties 12, 13, 14)', () => {
    let service: ConflictOrchestrationService;
    let conflictLogRepository: {
      findByIds: jest.Mock;
      updateOverride: jest.Mock;
      createLog: jest.Mock;
      createManyLogs: jest.Mock;
      findByVersion: jest.Mock;
      softDeleteByVersion: jest.Mock;
    };

    beforeEach(async () => {
      conflictLogRepository = {
        findByIds: jest.fn(),
        updateOverride: jest.fn().mockResolvedValue(undefined),
        createLog: jest.fn().mockResolvedValue({}),
        createManyLogs: jest.fn().mockResolvedValue([]),
        findByVersion: jest.fn().mockResolvedValue([[], 0]),
        softDeleteByVersion: jest.fn().mockResolvedValue(undefined),
      };

      const mockConflictDetectionService = {
        buildIndexes: jest.fn().mockReturnValue({
          teacherTimeslot: new Map(),
          roomTimeslot: new Map(),
          classTimeslot: new Map(),
          teacherDayPeriods: new Map(),
          subjectDays: new Map(),
          teacherDaySlots: new Map(),
          periodOrderMap: new Map(),
          roomCampusMap: new Map(),
        }),
        detectConflicts: jest.fn().mockReturnValue([]),
      };

      const mockConflictSlotRepository = {
        loadAllSlotsByVersion: jest.fn().mockResolvedValue([]),
        loadExistingSlots: jest.fn().mockResolvedValue([]),
        loadPeriodOrderMap: jest.fn().mockResolvedValue(new Map()),
        loadRoomCampusMap: jest.fn().mockResolvedValue(new Map()),
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
          { provide: ConflictLogRepository, useValue: conflictLogRepository },
        ],
      }).compile();

      service = module.get<ConflictOrchestrationService>(
        ConflictOrchestrationService,
      );
    });

    // ─── Property 12: Hard Constraints Always Block Save ──────────────────

    describe('Property 12: Hard Constraints Always Block Save', () => {
      /**
       * **Validates: Requirements 8.4, 10.2**
       *
       * Any conflict set with severity ERROR SHALL block save regardless of
       * whether an override reason is provided.
       */
      it('should always throw 422 when any conflict log has severity ERROR, regardless of override reason', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate at least 1 ERROR log, possibly mixed with WARNING logs
            fc.array(warningLogArb, { minLength: 0, maxLength: 5 }),
            fc.array(errorLogArb, { minLength: 1, maxLength: 3 }),
            validReasonArb,
            uuidArb, // slotId
            uuidArb, // userId
            uuidArb, // schoolId
            async (
              warningLogs,
              errorLogs,
              reason,
              slotId,
              userId,
              schoolId,
            ) => {
              // Mix WARNING and ERROR logs
              const allLogs = [...warningLogs, ...errorLogs];
              const logIds = allLogs.map((log) => log.id as string);

              // Mock findByIds to return the mixed set
              conflictLogRepository.findByIds.mockResolvedValue(allLogs);
              conflictLogRepository.updateOverride.mockClear();

              // Even with a valid override reason, should throw 422
              try {
                await service.overrideSoftConflicts(
                  slotId,
                  logIds,
                  { reason },
                  userId,
                  schoolId,
                );
                // Should not reach here
                throw new Error('Expected HttpException was not thrown');
              } catch (error) {
                expect(error).toBeInstanceOf(HttpException);
                const httpError = error as HttpException;
                expect(httpError.getStatus()).toBe(
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
                const response = httpError.getResponse() as Record<
                  string,
                  unknown
                >;
                expect(response['errorCode']).toBe('HARD_CONFLICT_DETECTED');
              }

              // updateOverride should never be called when hard conflicts present
              expect(
                conflictLogRepository.updateOverride,
              ).not.toHaveBeenCalled();
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    // ─── Property 13: Soft Constraints — Override Allows Proceed ───────────

    describe('Property 13: Soft Constraints — Override Allows Proceed', () => {
      /**
       * **Validates: Requirements 8.1, 8.2, 10.3**
       *
       * Only WARNING conflicts + valid override reason (≥10 chars) SHALL allow proceed.
       * Without valid reason, SHALL block.
       */
      it('should succeed when all logs are WARNING and reason is ≥10 chars', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(warningLogArb, { minLength: 1, maxLength: 5 }),
            validReasonArb,
            uuidArb, // slotId
            uuidArb, // userId
            uuidArb, // schoolId
            async (warningLogs, reason, slotId, userId, schoolId) => {
              const logIds = warningLogs.map((log) => log.id as string);

              // Mock findByIds to return only WARNING logs
              conflictLogRepository.findByIds.mockResolvedValue(warningLogs);
              conflictLogRepository.updateOverride.mockClear();

              // Should NOT throw — valid override
              await service.overrideSoftConflicts(
                slotId,
                logIds,
                { reason },
                userId,
                schoolId,
              );

              // updateOverride should have been called for each log
              expect(
                conflictLogRepository.updateOverride,
              ).toHaveBeenCalledTimes(warningLogs.length);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should throw 400 when all logs are WARNING but reason is <10 chars', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(warningLogArb, { minLength: 1, maxLength: 5 }),
            invalidReasonArb,
            uuidArb, // slotId
            uuidArb, // userId
            uuidArb, // schoolId
            async (warningLogs, reason, slotId, userId, schoolId) => {
              const logIds = warningLogs.map((log) => log.id as string);
              conflictLogRepository.findByIds.mockResolvedValue(warningLogs);
              conflictLogRepository.updateOverride.mockClear();

              try {
                await service.overrideSoftConflicts(
                  slotId,
                  logIds,
                  { reason },
                  userId,
                  schoolId,
                );
                throw new Error('Expected HttpException was not thrown');
              } catch (error) {
                expect(error).toBeInstanceOf(HttpException);
                const httpError = error as HttpException;
                expect(httpError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
                const response = httpError.getResponse() as Record<
                  string,
                  unknown
                >;
                expect(response['errorCode']).toBe('OVERRIDE_REASON_TOO_SHORT');
              }

              // updateOverride should never be called when reason is invalid
              expect(
                conflictLogRepository.updateOverride,
              ).not.toHaveBeenCalled();
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    // ─── Property 14: Override Creates Audit Log ──────────────────────────

    describe('Property 14: Override Creates Audit Log', () => {
      /**
       * **Validates: Requirements 8.3, 11.2**
       *
       * Every accepted override SHALL call updateOverride for each log
       * with the correct userId and reason (creating OVERRIDDEN status).
       */
      it('should call updateOverride for each log with userId and reason on accepted override', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(warningLogArb, { minLength: 1, maxLength: 5 }),
            validReasonArb,
            uuidArb, // slotId
            uuidArb, // userId
            uuidArb, // schoolId
            async (warningLogs, reason, slotId, userId, schoolId) => {
              const logIds = warningLogs.map((log) => log.id as string);

              conflictLogRepository.findByIds.mockResolvedValue(warningLogs);
              conflictLogRepository.updateOverride.mockClear();

              await service.overrideSoftConflicts(
                slotId,
                logIds,
                { reason },
                userId,
                schoolId,
              );

              // Verify updateOverride called exactly once per log
              expect(
                conflictLogRepository.updateOverride,
              ).toHaveBeenCalledTimes(warningLogs.length);

              // Verify each call received the correct userId and reason
              for (const log of warningLogs) {
                expect(
                  conflictLogRepository.updateOverride,
                ).toHaveBeenCalledWith(log.id, userId, reason);
              }
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Property 17: Intra-Batch Conflict Detection
  // Uses real checkers (pure function approach) — no mocking needed.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Property 17: Intra-Batch Conflict Detection', () => {
    const teacherChecker = new TeacherDoubleBookedChecker();
    const roomChecker = new RoomDoubleBookedChecker();
    const classChecker = new ClassDoubleBookedChecker();

    /**
     * Build empty ConflictIndexes.
     */
    function emptyIndexes(): ConflictIndexes {
      return {
        teacherTimeslot: new Map(),
        roomTimeslot: new Map(),
        classTimeslot: new Map(),
        teacherDayPeriods: new Map(),
        subjectDays: new Map(),
        teacherDaySlots: new Map(),
        periodOrderMap: new Map(),
        roomCampusMap: new Map(),
      };
    }

    /**
     * Add a SlotCheckPayload to indexes (simulating how checkBatch adds
     * each slot after checking it).
     */
    function addSlotToIndexes(
      indexes: ConflictIndexes,
      slot: SlotCheckPayload,
      rowIndex: number,
    ): void {
      const syntheticSlot = {
        id: `batch-${rowIndex}`,
        versionId: slot.versionId,
        dayOfWeek: slot.dayOfWeek,
        periodId: slot.periodId,
        teacherId: slot.teacherId,
        classId: slot.classId,
        roomId: slot.roomId,
        subjectId: slot.subjectId,
        class: { name: 'TestClass' },
        subject: { name: 'TestSubject' },
        teacher: { fullName: 'TestTeacher' },
      } as unknown as TimetableSlotEntity;

      const dayPeriodKey = `${slot.dayOfWeek}-${slot.periodId}`;

      indexes.teacherTimeslot.set(
        `${slot.teacherId}-${dayPeriodKey}`,
        syntheticSlot,
      );

      if (slot.roomId) {
        indexes.roomTimeslot.set(
          `${slot.roomId}-${dayPeriodKey}`,
          syntheticSlot,
        );
      }

      indexes.classTimeslot.set(
        `${slot.classId}-${dayPeriodKey}`,
        syntheticSlot,
      );
    }

    /**
     * **Validates: Requirements 10.1, 10.4**
     *
     * Two batch slots sharing same (dayOfWeek, periodId) and same teacherId
     * SHALL detect a teacher conflict when the second slot is checked against
     * indexes that include the first slot.
     */
    it('should detect teacher conflict between two batch slots at same timeslot', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          uuidArb, // different classId for second slot
          uuidArb, // different subjectId for second slot
          (firstSlot, differentClassId, differentSubjectId) => {
            // Second slot has SAME (teacherId, dayOfWeek, periodId) but different class
            const secondSlot: SlotCheckPayload = {
              ...firstSlot,
              classId: differentClassId,
              subjectId: differentSubjectId,
            };

            // Simulate batch processing: add first slot to indexes, then check second
            const indexes = emptyIndexes();
            addSlotToIndexes(indexes, firstSlot, 0);

            // Check second slot against indexes containing first slot
            const conflicts = teacherChecker.check(secondSlot, indexes);

            // Should detect teacher double-booking
            expect(conflicts.length).toBe(1);
            expect(conflicts[0].type).toBe(ConflictType.TEACHER_DOUBLE_BOOKED);
            expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements 10.1, 10.4**
     *
     * Two batch slots sharing same (dayOfWeek, periodId) and same roomId (non-null)
     * SHALL detect a room conflict.
     */
    it('should detect room conflict between two batch slots at same timeslot', () => {
      fc.assert(
        fc.property(
          // Generate first slot with guaranteed non-null roomId
          slotPayloadArb.chain((slot) =>
            uuidArb.map((roomId) => ({ ...slot, roomId })),
          ),
          uuidArb, // different teacherId for second slot
          uuidArb, // different classId for second slot
          (firstSlot, differentTeacherId, differentClassId) => {
            // Second slot has SAME (roomId, dayOfWeek, periodId) but different teacher/class
            const secondSlot: SlotCheckPayload = {
              ...firstSlot,
              teacherId: differentTeacherId,
              classId: differentClassId,
            };

            // Simulate batch processing
            const indexes = emptyIndexes();
            addSlotToIndexes(indexes, firstSlot, 0);

            const conflicts = roomChecker.check(secondSlot, indexes);

            expect(conflicts.length).toBe(1);
            expect(conflicts[0].type).toBe(ConflictType.ROOM_DOUBLE_BOOKED);
            expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements 10.1, 10.4**
     *
     * Two batch slots sharing same (dayOfWeek, periodId) and same classId
     * SHALL detect a class conflict.
     */
    it('should detect class conflict between two batch slots at same timeslot', () => {
      fc.assert(
        fc.property(
          slotPayloadArb,
          uuidArb, // different teacherId for second slot
          uuidArb, // different subjectId for second slot
          (firstSlot, differentTeacherId, differentSubjectId) => {
            // Second slot has SAME (classId, dayOfWeek, periodId) but different teacher/subject
            const secondSlot: SlotCheckPayload = {
              ...firstSlot,
              teacherId: differentTeacherId,
              subjectId: differentSubjectId,
            };

            // Simulate batch processing
            const indexes = emptyIndexes();
            addSlotToIndexes(indexes, firstSlot, 0);

            const conflicts = classChecker.check(secondSlot, indexes);

            expect(conflicts.length).toBe(1);
            expect(conflicts[0].type).toBe(ConflictType.CLASS_DOUBLE_BOOKED);
            expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
