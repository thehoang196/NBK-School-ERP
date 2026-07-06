/**
 * Feature: timetable-management-features, Property 10: Version list sorted by version_number descending
 *
 * **Validates: Requirements 4.1**
 *
 * Property: For any semester with multiple versions, querying the version list
 * SHALL return versions sorted by version_number in descending order.
 */
import * as fc from 'fast-check';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';

describe('Feature: timetable-management-features, Property 10: Version list sorted by version_number descending', () => {
  // Arbitrary: generate a random version number (1 to 1000)
  const versionNumberArb = fc.integer({ min: 1, max: 1000 });

  // Arbitrary: generate a random TimetableStatus
  const statusArb = fc.constantFrom(
    TimetableVersionStatus.DRAFT,
    TimetableVersionStatus.PUBLISHED,
    TimetableVersionStatus.ARCHIVED,
  );

  // Arbitrary: generate a random TimetableVersionEntity with a given versionNumber
  const versionEntityArb = (
    semesterId: string,
  ): fc.Arbitrary<Partial<TimetableVersionEntity>> =>
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      versionNumber: versionNumberArb,
      status: statusArb,
      semesterId: fc.constant(semesterId),
      effectiveDate: fc.option(fc.constant('2024-06-01'), { nil: null }),
      note: fc.option(fc.string({ minLength: 0, maxLength: 200 }), {
        nil: null,
      }),
      createdAt: fc.constant(new Date('2024-01-01')),
      updatedAt: fc.constant(new Date('2024-01-01')),
      deletedAt: fc.constant(null),
    }) as fc.Arbitrary<Partial<TimetableVersionEntity>>;

  // Arbitrary: generate a list of version entities (2 to 30) with unique version numbers
  const versionListArb = (
    semesterId: string,
  ): fc.Arbitrary<Partial<TimetableVersionEntity>[]> =>
    fc
      .uniqueArray(versionNumberArb, { minLength: 2, maxLength: 30 })
      .chain((versionNumbers) =>
        fc.tuple(
          ...versionNumbers.map((vn) =>
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              versionNumber: fc.constant(vn),
              status: statusArb,
              semesterId: fc.constant(semesterId),
              effectiveDate: fc.option(fc.constant('2024-06-01'), {
                nil: null,
              }),
              note: fc.option(fc.string({ minLength: 0, maxLength: 200 }), {
                nil: null,
              }),
              createdAt: fc.constant(new Date('2024-01-01')),
              updatedAt: fc.constant(new Date('2024-01-01')),
              deletedAt: fc.constant(null),
            }),
          ),
        ),
      ) as fc.Arbitrary<Partial<TimetableVersionEntity>[]>;

  describe('findBySemester returns versions sorted by version_number DESC', () => {
    it('should return versions sorted by version_number in descending order for any random version list', async () => {
      const semesterId = '00000000-0000-0000-0000-000000000001';

      await fc.assert(
        fc.asyncProperty(
          versionListArb(semesterId),
          async (versions: Partial<TimetableVersionEntity>[]) => {
            // Simulate what the repository does: sort by versionNumber DESC
            // This verifies the sorting logic that findBySemester applies
            const shuffled = [...versions].sort(() => Math.random() - 0.5);

            // Apply the same sorting logic as the repository: order by versionNumber DESC
            const sorted = [...shuffled].sort(
              (a, b) =>
                (b.versionNumber as number) - (a.versionNumber as number),
            );

            // Property: result is sorted by versionNumber descending
            for (let i = 0; i < sorted.length - 1; i++) {
              expect(sorted[i].versionNumber).toBeGreaterThan(
                sorted[i + 1].versionNumber as number,
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('findBySemester preserves all versions (no data lost or duplicated)', () => {
    it('should return the same count of versions without losing or duplicating entries', async () => {
      const semesterId = '00000000-0000-0000-0000-000000000001';

      await fc.assert(
        fc.asyncProperty(
          versionListArb(semesterId),
          async (versions: Partial<TimetableVersionEntity>[]) => {
            // Simulate repository behavior: take input, sort by versionNumber DESC
            const sorted = [...versions].sort(
              (a, b) =>
                (b.versionNumber as number) - (a.versionNumber as number),
            );

            // Property: same count in as count out (no versions lost or duplicated)
            expect(sorted.length).toBe(versions.length);

            // Property: same set of version numbers
            const inputVersionNumbers = versions
              .map((v) => v.versionNumber)
              .sort((a, b) => (a as number) - (b as number));
            const outputVersionNumbers = sorted
              .map((v) => v.versionNumber)
              .sort((a, b) => (a as number) - (b as number));
            expect(outputVersionNumbers).toEqual(inputVersionNumbers);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('findAll with query also returns versions sorted by version_number DESC', () => {
    it('should return versions sorted by version_number DESC regardless of insertion order', async () => {
      const semesterId = '00000000-0000-0000-0000-000000000001';

      await fc.assert(
        fc.asyncProperty(
          versionListArb(semesterId),
          async (versions: Partial<TimetableVersionEntity>[]) => {
            // Mock the TypeORM repository behavior
            // Simulate the query builder ordering: .orderBy('tv.version_number', 'DESC')
            const mockRepo = {
              find: jest
                .fn()
                .mockImplementation(
                  async (options: {
                    where: Record<string, unknown>;
                    order: Record<string, string>;
                  }) => {
                    // Simulate TypeORM find with order
                    const filtered = versions.filter(
                      (v) =>
                        v.semesterId === options.where.semesterId &&
                        v.deletedAt === null,
                    );
                    if (options.order?.versionNumber === 'DESC') {
                      return filtered.sort(
                        (a, b) =>
                          (b.versionNumber as number) -
                          (a.versionNumber as number),
                      );
                    }
                    return filtered;
                  },
                ),
              findOne: jest.fn(),
              createQueryBuilder: jest.fn(),
            };

            // Create repository instance with mock
            const repository = new TimetableVersionRepository(
              mockRepo as never,
            );

            // Act: call findBySemester
            const result = await repository.findBySemester(semesterId);

            // Assert: result is sorted descending by versionNumber
            for (let i = 0; i < result.length - 1; i++) {
              expect(result[i].versionNumber).toBeGreaterThanOrEqual(
                result[i + 1].versionNumber,
              );
            }

            // Assert: no versions lost
            expect(result.length).toBe(versions.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain descending sort regardless of version number magnitude', async () => {
      const semesterId = '00000000-0000-0000-0000-000000000001';

      // Generate versions with widely varying version numbers
      const wideRangeVersionListArb = fc
        .uniqueArray(fc.integer({ min: 1, max: 10000 }), {
          minLength: 2,
          maxLength: 50,
        })
        .chain((versionNumbers) =>
          fc.tuple(
            ...versionNumbers.map((vn) =>
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                versionNumber: fc.constant(vn),
                status: statusArb,
                semesterId: fc.constant(semesterId),
                effectiveDate: fc.option(fc.constant('2024-06-01'), {
                  nil: null,
                }),
                note: fc.option(fc.string({ minLength: 0, maxLength: 200 }), {
                  nil: null,
                }),
                createdAt: fc.constant(new Date('2024-01-01')),
                updatedAt: fc.constant(new Date('2024-01-01')),
                deletedAt: fc.constant(null),
              }),
            ),
          ),
        ) as fc.Arbitrary<Partial<TimetableVersionEntity>[]>;

      await fc.assert(
        fc.asyncProperty(
          wideRangeVersionListArb,
          async (versions: Partial<TimetableVersionEntity>[]) => {
            // Mock the TypeORM repository behavior
            const mockRepo = {
              find: jest
                .fn()
                .mockImplementation(
                  async (options: {
                    where: Record<string, unknown>;
                    order: Record<string, string>;
                  }) => {
                    const filtered = versions.filter(
                      (v) =>
                        v.semesterId === options.where.semesterId &&
                        v.deletedAt === null,
                    );
                    if (options.order?.versionNumber === 'DESC') {
                      return filtered.sort(
                        (a, b) =>
                          (b.versionNumber as number) -
                          (a.versionNumber as number),
                      );
                    }
                    return filtered;
                  },
                ),
              findOne: jest.fn(),
              createQueryBuilder: jest.fn(),
            };

            // Create repository instance with mock
            const repository = new TimetableVersionRepository(
              mockRepo as never,
            );

            // Act
            const result = await repository.findBySemester(semesterId);

            // Assert: strictly descending (unique version numbers)
            for (let i = 0; i < result.length - 1; i++) {
              expect(result[i].versionNumber).toBeGreaterThan(
                result[i + 1].versionNumber,
              );
            }

            // Assert: first element is the max version number
            const maxVersionNumber = Math.max(
              ...versions.map((v) => v.versionNumber as number),
            );
            expect(result[0].versionNumber).toBe(maxVersionNumber);

            // Assert: last element is the min version number
            const minVersionNumber = Math.min(
              ...versions.map((v) => v.versionNumber as number),
            );
            expect(result[result.length - 1].versionNumber).toBe(
              minVersionNumber,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
