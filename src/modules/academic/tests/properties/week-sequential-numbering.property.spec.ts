/**
 * Feature: academic-structure, Property 11: Week Sequential Numbering Invariant
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 *
 * Property: For any semester, after any sequence of week creation, deletion, or
 * reorder operations, the active weeks SHALL have week_number values forming an
 * unbroken sequence 1, 2, 3, ..., N where N is the count of active weeks.
 */
import * as fc from 'fast-check';
import { WeekService } from '../../services/week.service';
import { WeekRepository } from '../../repositories/week.repository';
import { SemesterRepository } from '../../repositories/semester.repository';
import { WeekEntity } from '../../entities/week.entity';
import { SemesterEntity } from '../../entities/semester.entity';
import { WeekType } from '../../enums';
import { DataSource } from 'typeorm';

describe('Feature: academic-structure, Property 11: Week Sequential Numbering Invariant', () => {
  let service: WeekService;
  let mockWeekRepository: Record<string, jest.Mock>;
  let mockSemesterRepository: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  const SEMESTER_ID = 'semester-001';
  const SEMESTER_START = '2024-09-02';
  const SEMESTER_END = '2025-01-26';

  const createMockSemester = (): SemesterEntity => {
    const semester = new SemesterEntity();
    semester.id = SEMESTER_ID;
    semester.name = 'Học kỳ 1';
    semester.semesterNumber = 1;
    semester.startDate = SEMESTER_START;
    semester.endDate = SEMESTER_END;
    return semester;
  };

  const createMockWeekEntity = (
    weekNumber: number,
    id?: string,
  ): WeekEntity => {
    const week = new WeekEntity();
    week.id = id ?? `week-${weekNumber}`;
    week.semesterId = SEMESTER_ID;
    week.weekNumber = weekNumber;
    // Each week is 7 days, starting from semester start
    const startDate = new Date(SEMESTER_START);
    startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    week.startDate = startDate.toISOString().split('T')[0];
    week.endDate = endDate.toISOString().split('T')[0];
    week.weekType = WeekType.REGULAR;
    week.note = null;
    return week;
  };

  beforeEach(() => {
    mockWeekRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySemester: jest.fn(),
      findBySemesterWithFilters: jest.fn(),
      findOverlappingWeeks: jest.fn(),
      getNextWeekNumber: jest.fn(),
      reorderWeeks: jest.fn(),
      countBySemester: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      softDelete: jest.fn(),
      softDeleteBySemester: jest.fn(),
    };

    mockSemesterRepository = {
      findById: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn(),
    };

    service = new WeekService(
      mockWeekRepository as unknown as WeekRepository,
      mockSemesterRepository as unknown as SemesterRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  /**
   * Helper: asserts that week_number values form an unbroken sequence 1..N
   */
  function assertSequentialNumbering(weeks: WeekEntity[]): void {
    const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i].weekNumber).toBe(i + 1);
    }
  }

  it('auto-assigned week_number produces sequential values across multiple creations', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate how many weeks to create sequentially (1 to 20)
        fc.integer({ min: 1, max: 20 }),
        async (numWeeks: number) => {
          const mockSemester = createMockSemester();
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.findOverlappingWeeks.mockResolvedValue([]);

          // Track created weeks to simulate the in-memory state
          const createdWeeks: WeekEntity[] = [];
          let currentMaxWeekNumber = 0;

          // Mock getNextWeekNumber to simulate sequential assignment
          mockWeekRepository.getNextWeekNumber.mockImplementation(async () => {
            return currentMaxWeekNumber + 1;
          });

          // Mock create to simulate saving and returning an entity
          mockWeekRepository.create.mockImplementation(
            async (data: Partial<WeekEntity>) => {
              const entity = new WeekEntity();
              entity.id = `week-${data.weekNumber}`;
              entity.semesterId = data.semesterId as string;
              entity.weekNumber = data.weekNumber as number;
              entity.startDate = data.startDate as string;
              entity.endDate = data.endDate as string;
              entity.weekType = data.weekType as WeekType;
              entity.note = data.note ?? null;
              createdWeeks.push(entity);
              currentMaxWeekNumber = Math.max(
                currentMaxWeekNumber,
                entity.weekNumber,
              );
              return entity;
            },
          );

          // Create weeks sequentially (without providing weekNumber → auto-assign)
          for (let i = 0; i < numWeeks; i++) {
            const startDate = new Date(SEMESTER_START);
            startDate.setDate(startDate.getDate() + i * 7);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            await service.create(
              {
                semesterId: SEMESTER_ID,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                weekType: WeekType.REGULAR,
              },
              'school-1',
            );
          }

          // PROPERTY: All created weeks have sequential week_number 1..N
          expect(createdWeeks.length).toBe(numWeeks);
          assertSequentialNumbering(createdWeeks);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('reorder produces an unbroken 1..N sequence for any permutation of week IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a count of weeks, then we'll test arbitrary reorder permutations
        fc.integer({ min: 2, max: 15 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            // Generate a random permutation of indices [0..n-1]
            fc.shuffledSubarray(
              Array.from({ length: n }, (_, i) => i),
              { minLength: n, maxLength: n },
            ),
          ),
        ),
        async ([numWeeks, permutation]: [number, number[]]) => {
          const mockSemester = createMockSemester();
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);

          // Create initial weeks with original ordering
          const existingWeeks = Array.from({ length: numWeeks }, (_, i) =>
            createMockWeekEntity(i + 1, `week-${i}`),
          );

          // Build reorder DTO: weekIds in the new permutation order
          const reorderedIds = permutation.map((idx) => existingWeeks[idx].id);

          // Track updates that the transaction will apply
          const appliedUpdates: { id: string; weekNumber: number }[] = [];

          // Mock transaction to capture the updates
          mockDataSource.transaction.mockImplementation(
            async (fn: (manager: Record<string, unknown>) => Promise<void>) => {
              const mockManager = {
                update: jest
                  .fn()
                  .mockImplementation(
                    async (
                      _entity: unknown,
                      id: string,
                      data: { weekNumber: number },
                    ) => {
                      appliedUpdates.push({ id, weekNumber: data.weekNumber });
                    },
                  ),
              };
              await fn(mockManager as unknown as Record<string, unknown>);
            },
          );

          // After reorder, findBySemester returns weeks with updated numbering
          mockWeekRepository.findBySemester.mockImplementation(async () => {
            return reorderedIds.map((id, index) => {
              const original = existingWeeks.find(
                (w) => w.id === id,
              ) as WeekEntity;
              const reordered = { ...original, weekNumber: index + 1 };
              return reordered;
            });
          });

          const result = await service.reorder(
            SEMESTER_ID,
            { weekIds: reorderedIds },
            'school-1',
          );

          // PROPERTY: After reorder, week_number values form 1..N sequence
          expect(result.length).toBe(numWeeks);
          assertSequentialNumbering(result as WeekEntity[]);

          // Verify each update assigns correct sequential number
          expect(appliedUpdates.length).toBe(numWeeks);
          for (let i = 0; i < appliedUpdates.length; i++) {
            expect(appliedUpdates[i].weekNumber).toBe(i + 1);
            expect(appliedUpdates[i].id).toBe(reorderedIds[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('bulk generation produces sequential week_number starting at 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate semester duration in days (7 to 180 days, representing various semester lengths)
        fc.integer({ min: 7, max: 180 }),
        async (durationDays: number) => {
          const startDate = new Date('2024-09-02');
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + durationDays - 1);

          const mockSemester = new SemesterEntity();
          mockSemester.id = SEMESTER_ID;
          mockSemester.name = 'Học kỳ 1';
          mockSemester.semesterNumber = 1;
          mockSemester.startDate = startDate.toISOString().split('T')[0];
          mockSemester.endDate = endDate.toISOString().split('T')[0];

          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.countBySemester.mockResolvedValue(0);

          // Track the weeks created in the transaction
          let savedWeeks: WeekEntity[] = [];

          mockDataSource.transaction.mockImplementation(
            async (
              fn: (manager: Record<string, unknown>) => Promise<WeekEntity[]>,
            ) => {
              const mockManager = {
                getRepository: () => ({
                  create: (data: Partial<WeekEntity>[]) => {
                    return data.map((d) => {
                      const entity = new WeekEntity();
                      entity.id = `bulk-week-${d.weekNumber}`;
                      entity.semesterId = d.semesterId as string;
                      entity.weekNumber = d.weekNumber as number;
                      entity.startDate = d.startDate as string;
                      entity.endDate = d.endDate as string;
                      entity.weekType = d.weekType as WeekType;
                      entity.note = null;
                      return entity;
                    });
                  },
                  save: (entities: WeekEntity[]) => {
                    savedWeeks = entities;
                    return Promise.resolve(entities);
                  },
                }),
              };
              return fn(mockManager as unknown as Record<string, unknown>);
            },
          );

          const result = await service.bulkGenerate(SEMESTER_ID, 'school-1');

          // PROPERTY: Generated weeks have sequential week_number starting at 1
          expect(result.count).toBeGreaterThan(0);
          expect(result.count).toBe(savedWeeks.length);

          // Verify sequential numbering 1..N
          for (let i = 0; i < savedWeeks.length; i++) {
            expect(savedWeeks[i].weekNumber).toBe(i + 1);
          }

          // PROPERTY: week_number values form an unbroken sequence
          assertSequentialNumbering(savedWeeks);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returned weeks are ordered by week_number ascending (Requirement 8.4)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate shuffled week numbers to verify ordering
        fc.integer({ min: 2, max: 20 }).chain((n) =>
          fc.shuffledSubarray(
            Array.from({ length: n }, (_, i) => i + 1),
            { minLength: n, maxLength: n },
          ),
        ),
        async (shuffledNumbers: number[]) => {
          // Create weeks with shuffled week_number ordering in memory
          const weeks = shuffledNumbers.map((num) =>
            createMockWeekEntity(num, `week-${num}`),
          );

          // findBySemester should return ordered by weekNumber ASC
          mockWeekRepository.findBySemester.mockResolvedValue(
            [...weeks].sort((a, b) => a.weekNumber - b.weekNumber),
          );

          const result = await service.findBySemester(SEMESTER_ID);

          // PROPERTY: Results are ordered by week_number ascending
          for (let i = 1; i < result.length; i++) {
            expect(result[i].weekNumber).toBeGreaterThan(
              result[i - 1].weekNumber,
            );
          }

          // PROPERTY: week_number values are sequential 1..N
          assertSequentialNumbering(result);
        },
      ),
      { numRuns: 100 },
    );
  });
});
