/**
 * Feature: academic-structure, Property 1: Week Type Filter Correctness
 *
 * **Validates: Requirements 1.4**
 *
 * Property: For any set of weeks with various `week_type` values and any subset
 * of `week_type` filter values, querying with those filters SHALL return exactly
 * the weeks whose `week_type` is in the filter set.
 */
import * as fc from 'fast-check';
import { WeekService } from '../../services/week.service';
import { WeekRepository } from '../../repositories/week.repository';
import { SemesterRepository } from '../../repositories/semester.repository';
import { WeekEntity } from '../../entities/week.entity';
import { WeekType } from '../../enums';
import { WeekQueryDto } from '../../dto/week';
import { DataSource } from 'typeorm';

describe('Feature: academic-structure, Property 1: Week Type Filter Correctness', () => {
  let service: WeekService;
  let mockWeekRepository: Record<string, jest.Mock>;
  let mockSemesterRepository: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  const allWeekTypes = [
    WeekType.REGULAR,
    WeekType.EXAM,
    WeekType.HOLIDAY,
    WeekType.MAKEUP,
  ];

  // Arbitrary: generate a WeekType value
  const weekTypeArb = fc.constantFrom(...allWeekTypes);

  // Arbitrary: generate a non-empty subset of WeekType values for filter
  const weekTypeFilterArb = fc.subarray(allWeekTypes, { minLength: 1 });

  // Arbitrary: generate a week-like entity with a random weekType
  const weekEntityArb = (weekType: WeekType, index: number): WeekEntity => {
    const entity = new WeekEntity();
    entity.id = `week-${index}-${weekType}`;
    entity.semesterId = 'semester-1';
    entity.weekNumber = index + 1;
    entity.startDate = '2024-01-01';
    entity.endDate = '2024-01-07';
    entity.weekType = weekType;
    entity.note = null;
    return entity;
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

  it('should return exactly the weeks whose weekType is in the filter set', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of random WeekType values (represents weeks in DB)
        fc.array(weekTypeArb, { minLength: 1, maxLength: 20 }),
        // Generate a non-empty subset of WeekType values as filter
        weekTypeFilterArb,
        async (weekTypes: WeekType[], filterTypes: WeekType[]) => {
          // Create week entities with the generated weekTypes
          const allWeeks = weekTypes.map((wt, idx) => weekEntityArb(wt, idx));

          // Expected result: only weeks whose weekType is in the filter set
          const expectedWeeks = allWeeks.filter((w) =>
            filterTypes.includes(w.weekType),
          );

          // Mock repository to simulate the filter behavior
          mockWeekRepository.findAll.mockImplementation(
            async (query: WeekQueryDto): Promise<[WeekEntity[], number]> => {
              const filtered = allWeeks.filter((w) => {
                if (query.weekType && query.weekType.length > 0) {
                  return query.weekType.includes(w.weekType);
                }
                return true;
              });
              return [filtered, filtered.length];
            },
          );

          // Build query with weekType filter
          const query = new WeekQueryDto();
          query.page = 1;
          query.limit = 100;
          query.weekType = filterTypes;

          // Call the service
          const result = await service.findAll(query, 'school-1');

          // Verify: result contains exactly the expected weeks
          expect(result.data.length).toBe(expectedWeeks.length);

          // Each returned week's weekType must be in the filter set
          for (const week of result.data) {
            expect(filterTypes).toContain(week.weekType);
          }

          // No week outside the filter set should appear
          const unexpectedWeeks = result.data.filter(
            (w) => !filterTypes.includes(w.weekType),
          );
          expect(unexpectedWeeks.length).toBe(0);

          // Verify completeness: all expected weeks are present
          const returnedIds = result.data.map((w) => w.id);
          for (const expected of expectedWeeks) {
            expect(returnedIds).toContain(expected.id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return all weeks when no weekType filter is applied', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of random WeekType values
        fc.array(weekTypeArb, { minLength: 1, maxLength: 20 }),
        async (weekTypes: WeekType[]) => {
          const allWeeks = weekTypes.map((wt, idx) => weekEntityArb(wt, idx));

          // Mock repository to return all weeks when no filter
          mockWeekRepository.findAll.mockImplementation(
            async (query: WeekQueryDto): Promise<[WeekEntity[], number]> => {
              const filtered = allWeeks.filter((w) => {
                if (query.weekType && query.weekType.length > 0) {
                  return query.weekType.includes(w.weekType);
                }
                return true;
              });
              return [filtered, filtered.length];
            },
          );

          // Query without weekType filter
          const query = new WeekQueryDto();
          query.page = 1;
          query.limit = 100;
          query.weekType = undefined;

          const result = await service.findAll(query, 'school-1');

          // All weeks should be returned
          expect(result.data.length).toBe(allWeeks.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return empty result when filter matches no weeks', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate weeks with only certain types
        fc.array(fc.constantFrom(WeekType.REGULAR, WeekType.EXAM), {
          minLength: 1,
          maxLength: 10,
        }),
        async (weekTypes: WeekType[]) => {
          const allWeeks = weekTypes.map((wt, idx) => weekEntityArb(wt, idx));

          // Use filter types that don't exist in the generated weeks
          const filterTypes = [WeekType.HOLIDAY, WeekType.MAKEUP];
          const hasOverlap = weekTypes.some((wt) => filterTypes.includes(wt));

          // Skip test case if there's overlap (we specifically test no-match)
          if (hasOverlap) return;

          mockWeekRepository.findAll.mockImplementation(
            async (query: WeekQueryDto): Promise<[WeekEntity[], number]> => {
              const filtered = allWeeks.filter((w) => {
                if (query.weekType && query.weekType.length > 0) {
                  return query.weekType.includes(w.weekType);
                }
                return true;
              });
              return [filtered, filtered.length];
            },
          );

          const query = new WeekQueryDto();
          query.page = 1;
          query.limit = 100;
          query.weekType = filterTypes;

          const result = await service.findAll(query, 'school-1');

          // No weeks should be returned since filter doesn't match any
          expect(result.data.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
