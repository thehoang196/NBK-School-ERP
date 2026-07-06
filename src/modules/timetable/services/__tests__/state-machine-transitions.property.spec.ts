import * as fc from 'fast-check';
import { TimetableVersionStateMachineService } from '../timetable-version-state-machine.service';
import { TimetableVersionStatus } from '../../../../common/enums/status.enum';
import { TimetableVersionEntity } from '../../entities/timetable-version.entity';
import { InvalidStateTransitionException } from '../../exceptions/invalid-state-transition.exception';
import { PublishedVersionImmutableException } from '../../exceptions/published-version-immutable.exception';

/**
 * Property 2: State Machine Transition Enforcement
 * Feature: fet-generation-pipeline
 *
 * For any (currentStatus, targetStatus) pair from the TimetableVersionStatus enum,
 * invoking a state transition SHALL succeed if and only if the pair is in the valid
 * transitions set. All other pairs SHALL be rejected with a descriptive error.
 *
 * **Validates: Requirements 2.2, 2.3**
 */
describe('Feature: fet-generation-pipeline, Property 2: State Machine Transition Enforcement', () => {
  const ALL_STATUSES: TimetableVersionStatus[] = Object.values(
    TimetableVersionStatus,
  );

  const VALID_TRANSITIONS: Array<
    [TimetableVersionStatus, TimetableVersionStatus]
  > = [
    [TimetableVersionStatus.DRAFT, TimetableVersionStatus.GENERATING],
    [TimetableVersionStatus.GENERATING, TimetableVersionStatus.GENERATED],
    [TimetableVersionStatus.GENERATING, TimetableVersionStatus.FAILED],
    [TimetableVersionStatus.GENERATED, TimetableVersionStatus.REVIEWING],
    [TimetableVersionStatus.REVIEWING, TimetableVersionStatus.PUBLISHED],
    [TimetableVersionStatus.REVIEWING, TimetableVersionStatus.DRAFT],
    [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.ARCHIVED],
    [TimetableVersionStatus.FAILED, TimetableVersionStatus.DRAFT],
  ];

  function isValidTransition(
    current: TimetableVersionStatus,
    target: TimetableVersionStatus,
  ): boolean {
    return VALID_TRANSITIONS.some(([c, t]) => c === current && t === target);
  }

  // Arbitrary for TimetableVersionStatus
  const statusArbitrary = fc.constantFrom(...ALL_STATUSES);

  // Arbitrary for (currentStatus, targetStatus) pairs
  const statusPairArbitrary = fc.tuple(statusArbitrary, statusArbitrary);

  let service: TimetableVersionStateMachineService;
  let mockRepository: { save: jest.Mock };

  beforeEach(() => {
    mockRepository = {
      save: jest
        .fn()
        .mockImplementation((entity: TimetableVersionEntity) =>
          Promise.resolve(entity),
        ),
    };
    service = new TimetableVersionStateMachineService(mockRepository as never);
  });

  describe('canTransition() - pure validation', () => {
    it('should return true ONLY for valid transitions and false for all others', () => {
      fc.assert(
        fc.property(statusPairArbitrary, ([currentStatus, targetStatus]) => {
          const result = service.canTransition(currentStatus, targetStatus);
          const expected = isValidTransition(currentStatus, targetStatus);

          expect(result).toBe(expected);
        }),
        { numRuns: 200 }, // More than 100 iterations; covers all 49 pairs multiple times
      );
    });

    it('should exhaustively verify all 49 (current × target) pairs', () => {
      for (const current of ALL_STATUSES) {
        for (const target of ALL_STATUSES) {
          const result = service.canTransition(current, target);
          const expected = isValidTransition(current, target);
          expect(result).toBe(expected);
        }
      }
    });
  });

  describe('transition() - stateful operation', () => {
    function createVersionEntity(
      status: TimetableVersionStatus,
    ): TimetableVersionEntity {
      const entity = new TimetableVersionEntity();
      entity.id = 'test-version-id';
      entity.status = status;
      entity.schoolId = 'test-school-id';
      entity.semesterId = 'test-semester-id';
      entity.name = 'Test Version';
      entity.versionNumber = 1;
      entity.version = 1;
      entity.hasConflicts = false;
      entity.conflictCount = 0;
      entity.conflictDetails = null;
      entity.totalSlots = 0;
      entity.jobId = null;
      entity.generationStartedAt = null;
      entity.generationCompletedAt = null;
      entity.generationDurationMs = null;
      entity.errorMessage = null;
      entity.errorStack = null;
      entity.publishedAt = null;
      entity.publishedBy = null;
      entity.effectiveDate = null;
      entity.note = null;
      return entity;
    }

    it('should succeed for valid transitions and reject invalid ones with a descriptive error', () => {
      fc.assert(
        fc.asyncProperty(
          statusPairArbitrary,
          async ([currentStatus, targetStatus]) => {
            // Clear call history before each iteration (keeps implementation)
            mockRepository.save.mockClear();

            const version = createVersionEntity(currentStatus);

            if (isValidTransition(currentStatus, targetStatus)) {
              // Valid transition: should succeed (save is called)
              const result = await service.transition(version, targetStatus);
              expect(result).toBeDefined();
              expect(mockRepository.save).toHaveBeenCalledTimes(1);
            } else {
              // Invalid transition: should throw
              await expect(
                service.transition(version, targetStatus),
              ).rejects.toThrow();
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('should throw InvalidStateTransitionException for invalid non-published transitions', () => {
      fc.assert(
        fc.asyncProperty(
          statusPairArbitrary,
          async ([currentStatus, targetStatus]) => {
            // Skip valid transitions
            if (isValidTransition(currentStatus, targetStatus)) return;
            // Skip published → non-archived (tested separately as PublishedVersionImmutableException)
            if (
              currentStatus === TimetableVersionStatus.PUBLISHED &&
              targetStatus !== TimetableVersionStatus.ARCHIVED
            ) {
              return;
            }

            const version = createVersionEntity(currentStatus);

            await expect(
              service.transition(version, targetStatus),
            ).rejects.toThrow(InvalidStateTransitionException);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('should throw PublishedVersionImmutableException for mutations on published versions (except archived)', () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            ...ALL_STATUSES.filter(
              (s) => s !== TimetableVersionStatus.ARCHIVED,
            ),
          ),
          async (targetStatus) => {
            const version = createVersionEntity(
              TimetableVersionStatus.PUBLISHED,
            );

            await expect(
              service.transition(version, targetStatus),
            ).rejects.toThrow(PublishedVersionImmutableException);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should call repository.save() for every valid transition', () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...VALID_TRANSITIONS),
          async ([currentStatus, targetStatus]) => {
            // Clear call history before each iteration (keeps implementation)
            mockRepository.save.mockClear();

            const version = createVersionEntity(currentStatus);

            await service.transition(version, targetStatus);

            expect(mockRepository.save).toHaveBeenCalledTimes(1);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
