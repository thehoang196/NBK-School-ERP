/**
 * Feature: academic-structure, Property 10: Academic Year Status Transition State Machine
 *
 * **Validates: Requirements 7.4, 7.5**
 *
 * For any academic year with status S and any target status T, the status transition
 * SHALL succeed if and only if the transition is in the set {planning→active, active→completed}.
 * All other transitions SHALL be rejected with an error.
 */
import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { AcademicYearService } from '../../services/academic-year.service';
import { AcademicYearRepository } from '../../repositories/academic-year.repository';
import { AcademicStatus } from '../../../../common/enums/status.enum';
import { InvalidStatusTransitionException } from '../../exceptions/invalid-status-transition.exception';
import { AcademicYearEntity } from '../../entities/academic-year.entity';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * The complete set of valid status transitions as defined by the state machine.
 * Only these (currentStatus, newStatus) pairs should be accepted.
 */
const VALID_TRANSITIONS: Array<[AcademicStatus, AcademicStatus]> = [
  [AcademicStatus.PLANNING, AcademicStatus.ACTIVE],
  [AcademicStatus.ACTIVE, AcademicStatus.COMPLETED],
];

const ALL_STATUSES: AcademicStatus[] = [
  AcademicStatus.PLANNING,
  AcademicStatus.ACTIVE,
  AcademicStatus.COMPLETED,
];

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const academicStatusArb: fc.Arbitrary<AcademicStatus> = fc.constantFrom(
  ...ALL_STATUSES,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidTransition(
  currentStatus: AcademicStatus,
  newStatus: AcademicStatus,
): boolean {
  return VALID_TRANSITIONS.some(
    ([from, to]) => from === currentStatus && to === newStatus,
  );
}

function createMockAcademicYear(
  id: string,
  schoolId: string,
  status: AcademicStatus,
): AcademicYearEntity {
  const entity = new AcademicYearEntity();
  entity.id = id;
  entity.schoolId = schoolId;
  entity.name = 'Năm học 2024-2025';
  entity.startDate = '2024-09-01';
  entity.endDate = '2025-06-30';
  entity.isCurrent = false;
  entity.status = status;
  entity.createdAt = new Date();
  entity.updatedAt = new Date();
  entity.deletedAt = null;
  return entity;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: academic-structure, Property 10: Academic Year Status Transition State Machine', () => {
  let service: AcademicYearService;
  let mockAcademicYearRepository: jest.Mocked<AcademicYearRepository>;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    mockAcademicYearRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySchool: jest.fn(),
      create: jest.fn(),
      createWithTransaction: jest.fn(),
      update: jest.fn(),
      findOverlapping: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<AcademicYearRepository>;

    mockDataSource = {
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    service = new AcademicYearService(
      mockAcademicYearRepository,
      mockDataSource,
    );
  });

  /**
   * **Validates: Requirements 7.4, 7.5**
   *
   * Valid transitions (planning→active, active→completed) SHALL succeed
   * and return the updated academic year with the new status.
   */
  it('should accept valid status transitions: planning→active, active→completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // academicYearId
        fc.uuid(), // schoolId
        fc.constantFrom(...VALID_TRANSITIONS), // [currentStatus, newStatus]
        async (academicYearId, schoolId, [currentStatus, newStatus]) => {
          // Reset mocks
          mockAcademicYearRepository.findById.mockReset();
          mockAcademicYearRepository.update.mockReset();

          // Setup: academic year exists with currentStatus
          const existingYear = createMockAcademicYear(
            academicYearId,
            schoolId,
            currentStatus,
          );
          mockAcademicYearRepository.findById.mockResolvedValueOnce(
            existingYear,
          );

          // Setup: update returns updated entity
          const updatedYear = createMockAcademicYear(
            academicYearId,
            schoolId,
            newStatus,
          );
          mockAcademicYearRepository.update.mockResolvedValueOnce(updatedYear);

          // Execute: should NOT throw
          const result = await service.transitionStatus(
            academicYearId,
            newStatus,
            schoolId,
          );

          // Verify: transition succeeds
          expect(result).toBeDefined();
          expect(result.status).toBe(newStatus);
          expect(mockAcademicYearRepository.update).toHaveBeenCalledWith(
            academicYearId,
            {
              status: newStatus,
            },
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.4, 7.5**
   *
   * Invalid transitions (all status pairs NOT in the valid set) SHALL be rejected
   * with InvalidStatusTransitionException.
   */
  it('should reject invalid status transitions with InvalidStatusTransitionException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // academicYearId
        fc.uuid(), // schoolId
        academicStatusArb, // currentStatus
        academicStatusArb, // targetStatus
        async (academicYearId, schoolId, currentStatus, targetStatus) => {
          // Only test invalid transitions
          fc.pre(!isValidTransition(currentStatus, targetStatus));

          // Reset mocks
          mockAcademicYearRepository.findById.mockReset();
          mockAcademicYearRepository.update.mockReset();

          // Setup: academic year exists with currentStatus
          const existingYear = createMockAcademicYear(
            academicYearId,
            schoolId,
            currentStatus,
          );
          mockAcademicYearRepository.findById.mockResolvedValueOnce(
            existingYear,
          );

          // Execute: should throw InvalidStatusTransitionException
          await expect(
            service.transitionStatus(academicYearId, targetStatus, schoolId),
          ).rejects.toThrow(InvalidStatusTransitionException);

          // Verify: update was NEVER called
          expect(mockAcademicYearRepository.update).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.4, 7.5**
   *
   * Biconditional property: for any (currentStatus, targetStatus) pair,
   * the transition succeeds if and only if it's in the valid transitions set.
   * This property tests both directions of the biconditional in a single pass.
   */
  it('should succeed if and only if transition is in {planning→active, active→completed}', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // academicYearId
        fc.uuid(), // schoolId
        academicStatusArb, // currentStatus
        academicStatusArb, // targetStatus
        async (academicYearId, schoolId, currentStatus, targetStatus) => {
          // Reset mocks
          mockAcademicYearRepository.findById.mockReset();
          mockAcademicYearRepository.update.mockReset();

          // Setup: academic year exists with currentStatus
          const existingYear = createMockAcademicYear(
            academicYearId,
            schoolId,
            currentStatus,
          );
          mockAcademicYearRepository.findById.mockResolvedValueOnce(
            existingYear,
          );

          const shouldSucceed = isValidTransition(currentStatus, targetStatus);

          if (shouldSucceed) {
            // Setup: update returns updated entity
            const updatedYear = createMockAcademicYear(
              academicYearId,
              schoolId,
              targetStatus,
            );
            mockAcademicYearRepository.update.mockResolvedValueOnce(
              updatedYear,
            );

            // Should succeed
            const result = await service.transitionStatus(
              academicYearId,
              targetStatus,
              schoolId,
            );
            expect(result).toBeDefined();
            expect(result.status).toBe(targetStatus);
            expect(mockAcademicYearRepository.update).toHaveBeenCalledWith(
              academicYearId,
              {
                status: targetStatus,
              },
            );
          } else {
            // Should throw InvalidStatusTransitionException
            await expect(
              service.transitionStatus(academicYearId, targetStatus, schoolId),
            ).rejects.toThrow(InvalidStatusTransitionException);

            // Verify: update was NEVER called
            expect(mockAcademicYearRepository.update).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.4, 7.5**
   *
   * Same-status transitions (planning→planning, active→active, completed→completed)
   * SHALL always be rejected since they are not in the valid transitions set.
   */
  it('should reject same-status transitions (no self-loops)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // academicYearId
        fc.uuid(), // schoolId
        academicStatusArb, // status (same for current and target)
        async (academicYearId, schoolId, status) => {
          // Reset mocks
          mockAcademicYearRepository.findById.mockReset();
          mockAcademicYearRepository.update.mockReset();

          // Setup: academic year exists with given status
          const existingYear = createMockAcademicYear(
            academicYearId,
            schoolId,
            status,
          );
          mockAcademicYearRepository.findById.mockResolvedValueOnce(
            existingYear,
          );

          // Execute: same→same should always throw
          await expect(
            service.transitionStatus(academicYearId, status, schoolId),
          ).rejects.toThrow(InvalidStatusTransitionException);

          // Verify: update was NEVER called
          expect(mockAcademicYearRepository.update).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.4, 7.5**
   *
   * Completed status is a terminal state: no transitions from completed SHALL succeed.
   */
  it('should reject all transitions from completed status (terminal state)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // academicYearId
        fc.uuid(), // schoolId
        academicStatusArb, // targetStatus (any)
        async (academicYearId, schoolId, targetStatus) => {
          // Reset mocks
          mockAcademicYearRepository.findById.mockReset();
          mockAcademicYearRepository.update.mockReset();

          // Setup: academic year is in COMPLETED status
          const existingYear = createMockAcademicYear(
            academicYearId,
            schoolId,
            AcademicStatus.COMPLETED,
          );
          mockAcademicYearRepository.findById.mockResolvedValueOnce(
            existingYear,
          );

          // Execute: any transition from completed should throw
          await expect(
            service.transitionStatus(academicYearId, targetStatus, schoolId),
          ).rejects.toThrow(InvalidStatusTransitionException);

          // Verify: update was NEVER called
          expect(mockAcademicYearRepository.update).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
