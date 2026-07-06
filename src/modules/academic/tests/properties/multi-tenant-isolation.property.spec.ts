/**
 * Feature: academic-structure, Property 13: Multi-Tenant Data Isolation
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 *
 * For any two schools A and B, and any query or mutation operation performed by a
 * user authenticated to school A, the operation SHALL never return, modify, or
 * reveal the existence of records belonging to school B.
 */
import * as fc from 'fast-check';
import { CampusGradeLevelService } from '../../services/campus-grade-level.service';
import { CampusGradeLevelRepository } from '../../repositories/campus-grade-level.repository';
import { CampusGradeLevelEntity } from '../../entities/campus-grade-level.entity';
import { CampusGradeLevelNotFoundException } from '../../exceptions';
import { CampusGradeLevelQueryDto } from '../../dto/campus-grade-level/campus-grade-level-query.dto';
import { GradeLevel } from '../../enums';

// ─── In-Memory Multi-Tenant Repository Mock ───────────────────────────────────

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

const schoolIdArb: fc.Arbitrary<string> = fc
  .integer({ min: 1, max: 20 })
  .map((n) => `school-${n}`);

const campusIdArb: fc.Arbitrary<string> = fc
  .integer({ min: 1, max: 15 })
  .map((n) => `campus-${n}`);

/**
 * Generate two distinct schoolIds for tenant isolation testing.
 */
const twoDistinctSchoolsArb: fc.Arbitrary<{
  schoolA: string;
  schoolB: string;
}> = fc
  .tuple(schoolIdArb, schoolIdArb)
  .filter(([a, b]) => a !== b)
  .map(([schoolA, schoolB]) => ({ schoolA, schoolB }));

/**
 * Generate a non-empty list of unique (campusId, gradeLevel) pairs for a school.
 */
const uniquePairsArb: fc.Arbitrary<
  Array<{ campusId: string; gradeLevel: GradeLevel }>
> = fc
  .array(fc.tuple(campusIdArb, gradeLevelArb), { minLength: 1, maxLength: 15 })
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

describe('Feature: academic-structure, Property 13: Multi-Tenant Data Isolation', () => {
  it('findByCampus with schoolA context never returns records belonging to schoolB', async () => {
    await fc.assert(
      fc.asyncProperty(
        twoDistinctSchoolsArb,
        uniquePairsArb,
        uniquePairsArb,
        campusIdArb,
        async (schools, pairsA, pairsB, queryCampusId) => {
          const { schoolA, schoolB } = schools;
          const mockRepo = createInMemoryRepository();
          const service = new CampusGradeLevelService(mockRepo);

          // Seed data for school A
          for (const pair of pairsA) {
            await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolA,
            );
          }

          // Seed data for school B
          for (const pair of pairsB) {
            await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolB,
            );
          }

          // Query with school A context — should never see school B records
          const results = await service.findByCampus(queryCampusId, schoolA);

          for (const record of results) {
            expect(record.schoolId).toBe(schoolA);
            expect(record.schoolId).not.toBe(schoolB);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('findByGradeLevel with schoolA context never returns records belonging to schoolB', async () => {
    await fc.assert(
      fc.asyncProperty(
        twoDistinctSchoolsArb,
        uniquePairsArb,
        uniquePairsArb,
        gradeLevelArb,
        async (schools, pairsA, pairsB, queryGradeLevel) => {
          const { schoolA, schoolB } = schools;
          const mockRepo = createInMemoryRepository();
          const service = new CampusGradeLevelService(mockRepo);

          // Seed data for school A
          for (const pair of pairsA) {
            await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolA,
            );
          }

          // Seed data for school B
          for (const pair of pairsB) {
            await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolB,
            );
          }

          // Query with school A context — should never see school B records
          const results = await service.findByGradeLevel(
            queryGradeLevel,
            schoolA,
          );

          for (const record of results) {
            expect(record.schoolId).toBe(schoolA);
            expect(record.schoolId).not.toBe(schoolB);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('remove with schoolA context cannot remove records belonging to schoolB (returns not found)', async () => {
    await fc.assert(
      fc.asyncProperty(
        twoDistinctSchoolsArb,
        uniquePairsArb,
        async (schools, pairsB) => {
          const { schoolA, schoolB } = schools;
          const mockRepo = createInMemoryRepository();
          const service = new CampusGradeLevelService(mockRepo);

          // Seed data for school B only
          const createdRecords: CampusGradeLevelEntity[] = [];
          for (const pair of pairsB) {
            const record = await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolB,
            );
            createdRecords.push(record);
          }

          // Attempt to remove school B's records using school A context
          for (const record of createdRecords) {
            await expect(service.remove(record.id, schoolA)).rejects.toThrow(
              CampusGradeLevelNotFoundException,
            );
          }

          // Verify school B records remain intact (not soft-deleted)
          for (const record of createdRecords) {
            const inMemory = mockRepo.records.find((r) => r.id === record.id);
            expect(inMemory?.deletedAt).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('assign with schoolA context sets schoolId to schoolA and is invisible to schoolB queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        twoDistinctSchoolsArb,
        uniquePairsArb,
        async (schools, pairs) => {
          const { schoolA, schoolB } = schools;
          const mockRepo = createInMemoryRepository();
          const service = new CampusGradeLevelService(mockRepo);

          // Assign records in school A context
          for (const pair of pairs) {
            const created = await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolA,
            );
            // Requirement 9.2: schoolId is set based on authenticated user's context
            expect(created.schoolId).toBe(schoolA);
          }

          // Query from school B context — should return empty for all campuses
          const campusIds = [...new Set(pairs.map((p) => p.campusId))];
          for (const campusId of campusIds) {
            const results = await service.findByCampus(campusId, schoolB);
            expect(results).toHaveLength(0);
          }

          // Query from school B context — should return empty for all grade levels
          const gradeLevels = [...new Set(pairs.map((p) => p.gradeLevel))];
          for (const gradeLevel of gradeLevels) {
            const results = await service.findByGradeLevel(gradeLevel, schoolB);
            expect(results).toHaveLength(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('records from different schools are completely isolated — existence is never revealed', async () => {
    await fc.assert(
      fc.asyncProperty(
        twoDistinctSchoolsArb,
        uniquePairsArb,
        uniquePairsArb,
        async (schools, pairsA, pairsB) => {
          const { schoolA, schoolB } = schools;
          const mockRepo = createInMemoryRepository();
          const service = new CampusGradeLevelService(mockRepo);

          // Seed data for both schools
          for (const pair of pairsA) {
            await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolA,
            );
          }
          for (const pair of pairsB) {
            await service.assign(
              { campusId: pair.campusId, gradeLevel: pair.gradeLevel },
              schoolB,
            );
          }

          // Query all records accessible from school A
          const queryDto = new CampusGradeLevelQueryDto();
          const allFromA = await service.findAll(queryDto, schoolA);

          // Query all records accessible from school B
          const allFromB = await service.findAll(queryDto, schoolB);

          // No record from school A should appear in school B results
          const idsFromA = new Set(allFromA.map((r) => r.id));
          const idsFromB = new Set(allFromB.map((r) => r.id));

          for (const id of idsFromA) {
            expect(idsFromB.has(id)).toBe(false);
          }
          for (const id of idsFromB) {
            expect(idsFromA.has(id)).toBe(false);
          }

          // All records from school A query belong to school A
          for (const record of allFromA) {
            expect(record.schoolId).toBe(schoolA);
          }

          // All records from school B query belong to school B
          for (const record of allFromB) {
            expect(record.schoolId).toBe(schoolB);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
