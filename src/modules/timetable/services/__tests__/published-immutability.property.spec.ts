/**
 * Feature: fet-generation-pipeline, Property 3: Published Version Immutability
 *
 * **Validates: Requirements 2.4**
 *
 * Property: For any TimetableVersion in "published" status and any attempted mutation
 * operation (update fields, modify slots, delete), the operation SHALL be rejected and
 * the version's data SHALL remain unchanged (except for the valid transition to "archived").
 */
import * as fc from 'fast-check';
import { Repository } from 'typeorm';
import { TimetableVersionStateMachineService } from '../timetable-version-state-machine.service';
import { TimetableVersionEntity } from '../../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../../common/enums/status.enum';
import { PublishedVersionImmutableException } from '../../exceptions/published-version-immutable.exception';

// --- Generators ---

/** Generator for UUID v4 strings */
const arbUuid = fc.uuid().map((u) => u as string);

/** Generator for version name */
const arbVersionName = fc.string({ minLength: 1, maxLength: 100 });

/** Generator for version number */
const arbVersionNumber = fc.integer({ min: 1, max: 1000 });

/** Generator for optimistic lock version */
const arbLockVersion = fc.integer({ min: 1, max: 100 });

/**
 * All statuses that should be REJECTED when transitioning from published.
 * Every status except 'archived' is invalid.
 */
const rejectedTargetStatuses: TimetableVersionStatus[] = [
  TimetableVersionStatus.DRAFT,
  TimetableVersionStatus.GENERATING,
  TimetableVersionStatus.GENERATED,
  TimetableVersionStatus.FAILED,
  TimetableVersionStatus.REVIEWING,
  TimetableVersionStatus.PUBLISHED, // self-transition
];

/** Generator for a target status that should be rejected from published */
const arbRejectedStatus = fc.constantFrom(...rejectedTargetStatuses);

/** Generator for a published TimetableVersionEntity with random field values */
const arbPublishedVersion = fc
  .record({
    id: arbUuid,
    schoolId: arbUuid,
    semesterId: arbUuid,
    name: arbVersionName,
    versionNumber: arbVersionNumber,
    version: arbLockVersion,
    publishedAt: fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    }),
    publishedBy: arbUuid,
    conflictCount: fc.integer({ min: 0, max: 50 }),
    hasConflicts: fc.boolean(),
    totalSlots: fc.integer({ min: 0, max: 500 }),
  })
  .map((data) => {
    const entity = new TimetableVersionEntity();
    entity.id = data.id;
    entity.schoolId = data.schoolId;
    entity.semesterId = data.semesterId;
    entity.name = data.name;
    entity.versionNumber = data.versionNumber;
    entity.version = data.version;
    entity.status = TimetableVersionStatus.PUBLISHED;
    entity.publishedAt = data.publishedAt;
    entity.publishedBy = data.publishedBy;
    entity.conflictCount = data.conflictCount;
    entity.hasConflicts = data.hasConflicts;
    entity.totalSlots = data.totalSlots;
    entity.generationStartedAt = null;
    entity.generationCompletedAt = null;
    entity.generationDurationMs = null;
    entity.errorMessage = null;
    entity.errorStack = null;
    entity.jobId = null;
    entity.conflictDetails = null;
    entity.effectiveDate = null;
    entity.note = null;
    return entity;
  });

describe('Feature: fet-generation-pipeline, Property 3: Published Version Immutability', () => {
  let service: TimetableVersionStateMachineService;
  let mockRepository: jest.Mocked<
    Pick<Repository<TimetableVersionEntity>, 'save'>
  >;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    service = new TimetableVersionStateMachineService(
      mockRepository as unknown as Repository<TimetableVersionEntity>,
    );
  });

  /**
   * **Validates: Requirements 2.4**
   *
   * For any published version and any target status except 'archived',
   * the transition SHALL be rejected with PublishedVersionImmutableException.
   */
  it('should reject all transitions from published except archived', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPublishedVersion,
        arbRejectedStatus,
        async (publishedVersion, targetStatus) => {
          // Act & Assert: transition must throw PublishedVersionImmutableException
          await expect(
            service.transition(publishedVersion, targetStatus),
          ).rejects.toThrow(PublishedVersionImmutableException);

          // Repository.save should never be called for rejected mutations
          expect(mockRepository.save).not.toHaveBeenCalled();

          // Reset mock for next iteration
          mockRepository.save.mockClear();
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  /**
   * **Validates: Requirements 2.4**
   *
   * For any published version and any rejected target status,
   * the version's data SHALL remain unchanged after the rejected mutation.
   */
  it('should leave version data unchanged after rejected mutation', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPublishedVersion,
        arbRejectedStatus,
        async (publishedVersion, targetStatus) => {
          // Capture original state before attempted mutation
          const originalState = {
            id: publishedVersion.id,
            status: publishedVersion.status,
            schoolId: publishedVersion.schoolId,
            semesterId: publishedVersion.semesterId,
            name: publishedVersion.name,
            versionNumber: publishedVersion.versionNumber,
            version: publishedVersion.version,
            publishedAt: publishedVersion.publishedAt,
            publishedBy: publishedVersion.publishedBy,
            conflictCount: publishedVersion.conflictCount,
            hasConflicts: publishedVersion.hasConflicts,
            totalSlots: publishedVersion.totalSlots,
            generationStartedAt: publishedVersion.generationStartedAt,
            generationCompletedAt: publishedVersion.generationCompletedAt,
            generationDurationMs: publishedVersion.generationDurationMs,
            errorMessage: publishedVersion.errorMessage,
            errorStack: publishedVersion.errorStack,
          };

          // Act: attempt mutation (should throw)
          try {
            await service.transition(publishedVersion, targetStatus);
          } catch {
            // Expected to throw
          }

          // Assert: all fields remain unchanged
          expect(publishedVersion.id).toBe(originalState.id);
          expect(publishedVersion.status).toBe(
            TimetableVersionStatus.PUBLISHED,
          );
          expect(publishedVersion.schoolId).toBe(originalState.schoolId);
          expect(publishedVersion.semesterId).toBe(originalState.semesterId);
          expect(publishedVersion.name).toBe(originalState.name);
          expect(publishedVersion.versionNumber).toBe(
            originalState.versionNumber,
          );
          expect(publishedVersion.version).toBe(originalState.version);
          expect(publishedVersion.publishedAt).toBe(originalState.publishedAt);
          expect(publishedVersion.publishedBy).toBe(originalState.publishedBy);
          expect(publishedVersion.conflictCount).toBe(
            originalState.conflictCount,
          );
          expect(publishedVersion.hasConflicts).toBe(
            originalState.hasConflicts,
          );
          expect(publishedVersion.totalSlots).toBe(originalState.totalSlots);
          expect(publishedVersion.generationStartedAt).toBe(
            originalState.generationStartedAt,
          );
          expect(publishedVersion.generationCompletedAt).toBe(
            originalState.generationCompletedAt,
          );
          expect(publishedVersion.generationDurationMs).toBe(
            originalState.generationDurationMs,
          );
          expect(publishedVersion.errorMessage).toBe(
            originalState.errorMessage,
          );
          expect(publishedVersion.errorStack).toBe(originalState.errorStack);

          // Reset mock for next iteration
          mockRepository.save.mockClear();
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  /**
   * **Validates: Requirements 2.4**
   *
   * For any published version, the transition to 'archived' SHALL succeed.
   * This is the only valid transition from the published state.
   */
  it('should allow transition from published to archived for any published version', async () => {
    await fc.assert(
      fc.asyncProperty(arbPublishedVersion, async (publishedVersion) => {
        // Setup mock to return the saved entity
        mockRepository.save.mockResolvedValue(publishedVersion);

        // Act: transition to archived should succeed
        const result = await service.transition(
          publishedVersion,
          TimetableVersionStatus.ARCHIVED,
        );

        // Assert: transition succeeded
        expect(result).toBeDefined();
        expect(publishedVersion.status).toBe(TimetableVersionStatus.ARCHIVED);
        expect(mockRepository.save).toHaveBeenCalledWith(publishedVersion);

        // Reset mock for next iteration
        mockRepository.save.mockClear();
      }),
      { numRuns: 100 },
    );
  }, 30000);
});
