/**
 * Feature: academic-structure, Property 6: Campus-Grade-Level Bidirectional Query Completeness
 *
 * **Validates: Requirements 3.6, 3.7**
 *
 * For any set of campus-grade-level associations, querying by campus SHALL return
 * all and only the grade levels associated with that campus, and querying by grade
 * level SHALL return all and only the campuses associated with that grade level.
 */
import * as fc from 'fast-check';
import { CampusGradeLevelService } from '../../services/campus-grade-level.service';
import { CampusGradeLevelRepository } from '../../repositories/campus-grade-level.repository';
import { CampusGradeLevelEntity } from '../../entities/campus-grade-level.entity';
import { GradeLevel } from '../../enums';

// ─── In-Memory Repository Mock ────────────────────────────────────────────────

interface InMemoryRecord {
  id: string;
  campusId: string;
  gradeLevel: GradeLevel;
  schoolId: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createInMemoryRepository(): CampusGradeLevelRepository & {
  records: InMemoryRecord[];
} {
  const records: InMemoryRecord[] = [];
  let idCounter = 0;

  const repo = {
    records,

    async create(
      data: Partial<CampusGradeLevelEntity>,
    ): Promise<CampusGradeLevelEntity> {
      const record: InMemoryRecord = {
        id: `id-${++idCounter}`,
        campusId: data.campusId!,
        gradeLevel: data.gradeLevel!,
        schoolId: data.schoolId!,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.push(record);
      return record as unknown as CampusGradeLevelEntity;
    },

    async findAllBySchool(schoolId: string): Promise<CampusGradeLevelEntity[]> {
      return records.filter(
        (r) => r.schoolId === schoolId && r.deletedAt === null,
      ) as unknown as CampusGradeLevelEntity[];
    },

    async findByCampus(
      campusId: string,
      schoolId: string,
    ): Promise<CampusGradeLevelEntity[]> {
      return records.filter(
        (r) =>
          r.campusId === campusId &&
          r.schoolId === schoolId &&
          r.deletedAt === null,
      ) as unknown as CampusGradeLevelEntity[];
    },

    async findByGradeLevel(
      gradeLevel: GradeLevel,
      schoolId: string,
    ): Promise<CampusGradeLevelEntity[]> {
      return records.filter(
        (r) =>
          r.gradeLevel === gradeLevel &&
          r.schoolId === schoolId &&
          r.deletedAt === null,
      ) as unknown as CampusGradeLevelEntity[];
    },

    async findByCampusAndGrade(
      campusId: string,
      gradeLevel: GradeLevel,
      schoolId: string,
    ): Promise<CampusGradeLevelEntity | null> {
      const found = records.find(
        (r) =>
          r.campusId === campusId &&
          r.gradeLevel === gradeLevel &&
          r.schoolId === schoolId &&
          r.deletedAt === null,
      );
      return (found as unknown as CampusGradeLevelEntity) ?? null;
    },

    async findById(
      id: string,
      schoolId: string,
    ): Promise<CampusGradeLevelEntity | null> {
      const found = records.find(
        (r) => r.id === id && r.schoolId === schoolId && r.deletedAt === null,
      );
      return (found as unknown as CampusGradeLevelEntity) ?? null;
    },

    async softDelete(id: string): Promise<void> {
      const record = records.find((r) => r.id === id);
      if (record) {
        record.deletedAt = new Date();
      }
    },
  };

  return repo as unknown as CampusGradeLevelRepository & {
    records: InMemoryRecord[];
  };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const gradeLevelArb: fc.Arbitrary<GradeLevel> = fc.constantFrom(
  GradeLevel.PRIMARY,
  GradeLevel.MIDDLE_SCHOOL,
  GradeLevel.HIGH_SCHOOL,
);

const campusIdArb: fc.Arbitrary<string> = fc
  .integer({ min: 1, max: 10 })
  .map((n) => `campus-${n}`);

/**
 * Generate a set of unique (campusId, gradeLevel) pairs.
 * We use a set to ensure no duplicates since that would cause conflicts.
 */
const uniquePairsArb: fc.Arbitrary<
  Array<{ campusId: string; gradeLevel: GradeLevel }>
> = fc
  .array(fc.tuple(campusIdArb, gradeLevelArb), { minLength: 1, maxLength: 30 })
  .map((tuples) => {
    const seen = new Set<string>();
    const unique: Array<{ campusId: string; gradeLevel: GradeLevel }> = [];
    for (const [campusId, gradeLevel] of tuples) {
      const key = `${campusId}|${gradeLevel}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ campusId, gradeLevel });
      }
    }
    return unique;
  })
  .filter((pairs) => pairs.length >= 1);

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: academic-structure, Property 6: Campus-Grade-Level Bidirectional Query Completeness', () => {
  const schoolId = 'school-001';

  it('findByCampus returns all and only the grade levels associated with that campus', async () => {
    await fc.assert(
      fc.asyncProperty(uniquePairsArb, async (pairs) => {
        const mockRepo = createInMemoryRepository();
        const service = new CampusGradeLevelService(mockRepo);

        // Assign all pairs
        for (const pair of pairs) {
          await service.assign(
            { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
            schoolId,
          );
        }

        // For each unique campus in the set, query and verify
        const campusIds = [...new Set(pairs.map((p) => p.campusId))];

        for (const campusId of campusIds) {
          const result = await service.findByCampus(campusId, schoolId);
          const resultGradeLevels = result.map((r) => r.gradeLevel).sort();

          // Expected: all grade levels paired with this campus
          const expectedGradeLevels = pairs
            .filter((p) => p.campusId === campusId)
            .map((p) => p.gradeLevel)
            .sort();

          expect(resultGradeLevels).toEqual(expectedGradeLevels);

          // Verify completeness: every expected grade level is returned
          for (const expected of expectedGradeLevels) {
            expect(resultGradeLevels).toContain(expected);
          }

          // Verify exclusivity: no extra grade levels are returned
          expect(resultGradeLevels.length).toBe(expectedGradeLevels.length);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('findByGradeLevel returns all and only the campuses associated with that grade level', async () => {
    await fc.assert(
      fc.asyncProperty(uniquePairsArb, async (pairs) => {
        const mockRepo = createInMemoryRepository();
        const service = new CampusGradeLevelService(mockRepo);

        // Assign all pairs
        for (const pair of pairs) {
          await service.assign(
            { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
            schoolId,
          );
        }

        // For each unique grade level in the set, query and verify
        const gradeLevels = [...new Set(pairs.map((p) => p.gradeLevel))];

        for (const gradeLevel of gradeLevels) {
          const result = await service.findByGradeLevel(gradeLevel, schoolId);
          const resultCampusIds = result.map((r) => r.campusId).sort();

          // Expected: all campuses paired with this grade level
          const expectedCampusIds = pairs
            .filter((p) => p.gradeLevel === gradeLevel)
            .map((p) => p.campusId)
            .sort();

          expect(resultCampusIds).toEqual(expectedCampusIds);

          // Verify completeness: every expected campus is returned
          for (const expected of expectedCampusIds) {
            expect(resultCampusIds).toContain(expected);
          }

          // Verify exclusivity: no extra campuses are returned
          expect(resultCampusIds.length).toBe(expectedCampusIds.length);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('bidirectional consistency: campus query and grade query are mutually consistent', async () => {
    await fc.assert(
      fc.asyncProperty(uniquePairsArb, async (pairs) => {
        const mockRepo = createInMemoryRepository();
        const service = new CampusGradeLevelService(mockRepo);

        // Assign all pairs
        for (const pair of pairs) {
          await service.assign(
            { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
            schoolId,
          );
        }

        // For each pair (campusId, gradeLevel):
        // - findByCampus(campusId) must contain gradeLevel
        // - findByGradeLevel(gradeLevel) must contain campusId
        for (const pair of pairs) {
          const byCampus = await service.findByCampus(pair.campusId, schoolId);
          const byCampusGradeLevels = byCampus.map((r) => r.gradeLevel);
          expect(byCampusGradeLevels).toContain(pair.gradeLevel);

          const byGrade = await service.findByGradeLevel(
            pair.gradeLevel,
            schoolId,
          );
          const byGradeCampusIds = byGrade.map((r) => r.campusId);
          expect(byGradeCampusIds).toContain(pair.campusId);
        }
      }),
      { numRuns: 100 },
    );
  });
});
