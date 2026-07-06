/**
 * Feature: academic-structure, Property 9: Academic Year Singleton Current Invariant
 *
 * **Validates: Requirements 7.1, 7.2**
 *
 * For any school and any sequence of setCurrent operations on academic years,
 * at most one academic year SHALL have is_current = true at any point in time.
 * Setting a new year as current SHALL atomically unset the previous one.
 */
import * as fc from 'fast-check';
import { NotFoundException } from '@nestjs/common';
import { AcademicYearService } from '../../services/academic-year.service';
import { AcademicYearRepository } from '../../repositories/academic-year.repository';
import { AcademicYearEntity } from '../../entities/academic-year.entity';
import { AcademicStatus } from '../../../../common/enums/status.enum';
import { DataSource } from 'typeorm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MockAcademicYear {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: AcademicStatus;
  deletedAt: null;
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const academicYearArb = (schoolId: string): fc.Arbitrary<MockAcademicYear> =>
  fc.record({
    id: fc.uuid(),
    schoolId: fc.constant(schoolId),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    startDate: fc.constant('2024-01-01'),
    endDate: fc.constant('2024-12-31'),
    isCurrent: fc.constant(false),
    status: fc.constant(AcademicStatus.PLANNING),
    deletedAt: fc.constant(null),
  });

/**
 * Generate a list of 2–5 academic years for the same school,
 * then produce a random sequence of setCurrent operations.
 */
const setCurrentSequenceArb = fc.uuid().chain((schoolId) =>
  fc
    .tuple(
      fc.array(academicYearArb(schoolId), { minLength: 2, maxLength: 5 }),
      fc.constant(schoolId),
    )
    .chain(([years, sid]) =>
      fc.tuple(
        fc.constant(years),
        fc.constant(sid),
        // sequence of indices into the years array to setCurrent
        fc.array(fc.nat({ max: years.length - 1 }), {
          minLength: 1,
          maxLength: 10,
        }),
      ),
    ),
);

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: academic-structure, Property 9: Academic Year Singleton Current Invariant', () => {
  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * For any school and any sequence of setCurrent operations, at most one
   * academic year has is_current = true at any point in time.
   */
  it('should ensure at most one academic year is current after any sequence of setCurrent operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        setCurrentSequenceArb,
        async ([years, schoolId, setCurrentSequence]) => {
          // In-memory state tracking all academic years
          const state: MockAcademicYear[] = years.map((y) => ({ ...y }));

          // Mock repository
          const mockRepository: Partial<jest.Mocked<AcademicYearRepository>> = {
            findById: jest.fn(),
          };

          // Mock DataSource with transaction that simulates atomic setCurrent
          const mockDataSource: Partial<DataSource> = {
            transaction: jest.fn(),
          };

          // Create the service with mocked deps
          const service = new AcademicYearService(
            mockRepository as unknown as AcademicYearRepository,
            mockDataSource as unknown as DataSource,
          );

          // Configure the transaction mock to simulate the atomic operation
          (mockDataSource.transaction as jest.Mock).mockImplementation(
            async (cb: (manager: unknown) => Promise<void>) => {
              // Simulate what the transaction does internally:
              // The manager will be called with createQueryBuilder for both operations
              const executedUpdates: Array<{
                type: 'unset' | 'set';
                id?: string;
                schoolId?: string;
              }> = [];

              const mockManager = {
                createQueryBuilder: jest.fn().mockReturnValue({
                  update: jest.fn().mockReturnThis(),
                  set: jest.fn().mockImplementation(function (
                    this: unknown,
                    data: Record<string, boolean>,
                  ) {
                    (this as { _setData: Record<string, boolean> })._setData =
                      data;
                    return this;
                  }),
                  where: jest.fn().mockImplementation(function (
                    this: unknown,
                    _condition: string,
                    params?: Record<string, unknown>,
                  ) {
                    (
                      this as { _whereParams: Record<string, unknown> }
                    )._whereParams = {
                      ...((this as { _whereParams?: Record<string, unknown> })
                        ._whereParams || {}),
                      ...params,
                    };
                    return this;
                  }),
                  andWhere: jest.fn().mockImplementation(function (
                    this: unknown,
                    _condition: string,
                    params?: Record<string, unknown>,
                  ) {
                    (
                      this as { _whereParams: Record<string, unknown> }
                    )._whereParams = {
                      ...((this as { _whereParams?: Record<string, unknown> })
                        ._whereParams || {}),
                      ...params,
                    };
                    return this;
                  }),
                  execute: jest.fn().mockImplementation(function (this: {
                    _setData?: Record<string, boolean>;
                    _whereParams?: Record<string, unknown>;
                  }) {
                    const setData = this._setData;
                    const whereParams = this._whereParams || {};

                    if (
                      setData &&
                      'isCurrent' in setData &&
                      setData.isCurrent === false
                    ) {
                      // Unset all current for this school
                      const targetSchoolId = whereParams['schoolId'] as string;
                      executedUpdates.push({
                        type: 'unset',
                        schoolId: targetSchoolId,
                      });
                      for (const ay of state) {
                        if (ay.schoolId === targetSchoolId && ay.isCurrent) {
                          ay.isCurrent = false;
                        }
                      }
                    } else if (
                      setData &&
                      'isCurrent' in setData &&
                      setData.isCurrent === true
                    ) {
                      // Set specific academic year as current
                      const targetId = whereParams['id'] as string;
                      executedUpdates.push({ type: 'set', id: targetId });
                      const target = state.find((ay) => ay.id === targetId);
                      if (target) {
                        target.isCurrent = true;
                      }
                    }
                    return Promise.resolve();
                  }),
                }),
              };

              await cb(mockManager);
            },
          );

          // Execute the sequence of setCurrent operations
          for (const idx of setCurrentSequence) {
            const targetYear = state[idx];

            // Mock findById to return the current state of the target year
            (mockRepository.findById as jest.Mock).mockResolvedValue({
              ...targetYear,
            } as AcademicYearEntity);

            await service.setCurrent(targetYear.id, schoolId);

            // INVARIANT: After each setCurrent, at most one academic year has isCurrent = true
            const currentYears = state.filter((ay) => ay.isCurrent);
            expect(currentYears.length).toBeLessThanOrEqual(1);

            // The one that is current must be the one we just set
            if (currentYears.length === 1) {
              expect(currentYears[0].id).toBe(targetYear.id);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * Setting the same academic year as current multiple times should still
   * result in exactly one current academic year.
   */
  it('should maintain singleton invariant when setting same year as current repeatedly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // schoolId
        fc.uuid(), // yearId
        fc.integer({ min: 2, max: 5 }), // repeat count
        async (schoolId, yearId, repeatCount) => {
          const state: MockAcademicYear = {
            id: yearId,
            schoolId,
            name: 'Test Year',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            isCurrent: false,
            status: AcademicStatus.PLANNING,
            deletedAt: null,
          };

          const mockRepository: Partial<jest.Mocked<AcademicYearRepository>> = {
            findById: jest
              .fn()
              .mockResolvedValue({ ...state } as unknown as AcademicYearEntity),
          };

          const mockDataSource: Partial<DataSource> = {
            transaction: jest
              .fn()
              .mockImplementation(
                async (cb: (manager: unknown) => Promise<void>) => {
                  const mockManager = {
                    createQueryBuilder: jest.fn().mockReturnValue({
                      update: jest.fn().mockReturnThis(),
                      set: jest.fn().mockImplementation(function (
                        this: unknown,
                        data: Record<string, boolean>,
                      ) {
                        (
                          this as { _setData: Record<string, boolean> }
                        )._setData = data;
                        return this;
                      }),
                      where: jest.fn().mockReturnThis(),
                      andWhere: jest.fn().mockReturnThis(),
                      execute: jest.fn().mockImplementation(function (this: {
                        _setData?: Record<string, boolean>;
                      }) {
                        if (
                          this._setData &&
                          this._setData.isCurrent === false
                        ) {
                          state.isCurrent = false;
                        } else if (
                          this._setData &&
                          this._setData.isCurrent === true
                        ) {
                          state.isCurrent = true;
                        }
                        return Promise.resolve();
                      }),
                    }),
                  };
                  await cb(mockManager);
                },
              ),
          };

          const service = new AcademicYearService(
            mockRepository as unknown as AcademicYearRepository,
            mockDataSource as unknown as DataSource,
          );

          // Set the same year as current multiple times
          for (let i = 0; i < repeatCount; i++) {
            await service.setCurrent(yearId, schoolId);
            // After each operation, the year should be current
            expect(state.isCurrent).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * setCurrent should throw NotFoundException when the academic year
   * does not exist or belongs to a different school.
   */
  it('should throw NotFoundException when academic year not found or belongs to different school', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // yearId
        fc.uuid(), // requestSchoolId
        fc.uuid(), // actualSchoolId (different)
        async (yearId, requestSchoolId, actualSchoolId) => {
          // Ensure the schools are different for the second sub-test
          fc.pre(requestSchoolId !== actualSchoolId);

          const mockRepository: Partial<jest.Mocked<AcademicYearRepository>> = {
            findById: jest.fn(),
          };

          const mockDataSource: Partial<DataSource> = {
            transaction: jest.fn(),
          };

          const service = new AcademicYearService(
            mockRepository as unknown as AcademicYearRepository,
            mockDataSource as unknown as DataSource,
          );

          // Case 1: Academic year not found (null)
          (mockRepository.findById as jest.Mock).mockResolvedValueOnce(null);
          await expect(
            service.setCurrent(yearId, requestSchoolId),
          ).rejects.toThrow(NotFoundException);

          // Case 2: Academic year belongs to a different school
          (mockRepository.findById as jest.Mock).mockResolvedValueOnce({
            id: yearId,
            schoolId: actualSchoolId,
            name: 'Test',
            isCurrent: false,
            status: AcademicStatus.PLANNING,
            deletedAt: null,
          } as unknown as AcademicYearEntity);
          await expect(
            service.setCurrent(yearId, requestSchoolId),
          ).rejects.toThrow(NotFoundException);

          // Verify transaction was never called (operation rejected before transaction)
          expect(mockDataSource.transaction).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
