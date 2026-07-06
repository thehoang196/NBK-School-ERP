/**
 * Feature: academic-structure, Property 8: Session and Period Definition Filter Correctness
 *
 * **Validates: Requirements 5.5, 6.6**
 *
 * For any set of sessions (or period definitions) and any filter combination
 * of campus_id and/or grade_level (and/or session_id), the query SHALL return
 * exactly those records matching all specified filter criteria.
 */
import * as fc from 'fast-check';
import { SessionService } from '../../services/session.service';
import { SessionRepository } from '../../repositories/session.repository';
import { CampusGradeLevelRepository } from '../../repositories/campus-grade-level.repository';
import { PeriodDefinitionService } from '../../services/period-definition.service';
import { PeriodDefinitionRepository } from '../../repositories/period-definition.repository';
import { SessionEntity } from '../../entities/session.entity';
import { PeriodDefinitionEntity } from '../../entities/period-definition.entity';
import { GradeLevel } from '../../enums';
import { SessionQueryDto } from '../../dto/session';
import { PeriodDefinitionQueryDto } from '../../dto/period-definition';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const gradeLevelArb: fc.Arbitrary<GradeLevel> = fc.constantFrom(
  GradeLevel.PRIMARY,
  GradeLevel.MIDDLE_SCHOOL,
  GradeLevel.HIGH_SCHOOL,
);

/** Generate a small pool of campus IDs to increase filter match probability */
const campusIdPoolArb: fc.Arbitrary<string[]> = fc.array(fc.uuid(), {
  minLength: 2,
  maxLength: 5,
});

/** Generate a small pool of session IDs for period definitions */
const sessionIdPoolArb: fc.Arbitrary<string[]> = fc.array(fc.uuid(), {
  minLength: 2,
  maxLength: 5,
});

/** Generate a session entity with arbitrary campusId and gradeLevel */
function sessionEntityArb(campusIdPool: string[]): fc.Arbitrary<SessionEntity> {
  return fc
    .record({
      id: fc.uuid(),
      campusId: fc.constantFrom(...campusIdPool),
      gradeLevel: gradeLevelArb,
      schoolId: fc.constant('school-1'),
      name: fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => s.trim().length > 0),
      sortOrder: fc.integer({ min: 0, max: 50 }),
    })
    .map((data) => {
      const entity = new SessionEntity();
      entity.id = data.id;
      entity.campusId = data.campusId;
      entity.gradeLevel = data.gradeLevel;
      entity.schoolId = data.schoolId;
      entity.name = data.name;
      entity.startTime = '08:00';
      entity.endTime = '12:00';
      entity.sortOrder = data.sortOrder;
      entity.deletedAt = null;
      return entity;
    });
}

/** Generate a period definition entity with arbitrary sessionId and gradeLevel */
function periodDefinitionEntityArb(
  sessionIdPool: string[],
): fc.Arbitrary<PeriodDefinitionEntity> {
  return fc
    .record({
      id: fc.uuid(),
      sessionId: fc.constantFrom(...sessionIdPool),
      gradeLevel: gradeLevelArb,
      schoolId: fc.constant('school-1'),
      periodNumber: fc.integer({ min: 1, max: 10 }),
      isBreak: fc.boolean(),
    })
    .map((data) => {
      const entity = new PeriodDefinitionEntity();
      entity.id = data.id;
      entity.sessionId = data.sessionId;
      entity.gradeLevel = data.gradeLevel;
      entity.schoolId = data.schoolId;
      entity.periodNumber = data.periodNumber;
      entity.startTime = '08:00';
      entity.endTime = '08:45';
      entity.isBreak = data.isBreak;
      entity.isExtra = false;
      entity.deletedAt = null;
      return entity;
    });
}

// ─── Session Filter Tests ─────────────────────────────────────────────────────

describe('Feature: academic-structure, Property 8: Session and Period Definition Filter Correctness', () => {
  describe('SessionService.findAll filter correctness', () => {
    let sessionService: SessionService;
    let mockSessionRepository: jest.Mocked<SessionRepository>;
    let mockCampusGradeLevelRepository: jest.Mocked<CampusGradeLevelRepository>;

    beforeEach(() => {
      mockSessionRepository = {
        findAll: jest.fn(),
        findById: jest.fn(),
        findBySchool: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      } as unknown as jest.Mocked<SessionRepository>;

      mockCampusGradeLevelRepository = {
        create: jest.fn(),
        findByCampusAndGrade: jest.fn(),
        findByCampus: jest.fn(),
        findByGradeLevel: jest.fn(),
        findAllBySchool: jest.fn(),
        findById: jest.fn(),
        softDelete: jest.fn(),
      } as unknown as jest.Mocked<CampusGradeLevelRepository>;

      sessionService = new SessionService(
        mockSessionRepository,
        mockCampusGradeLevelRepository,
      );
    });

    /**
     * **Validates: Requirements 5.5**
     *
     * For any set of sessions and any filter combination of campusId and/or gradeLevel,
     * the query returns exactly those sessions matching ALL specified filter criteria.
     */
    it('should return exactly sessions matching campusId and/or gradeLevel filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          campusIdPoolArb.chain((campusIds) =>
            fc.record({
              campusIds: fc.constant(campusIds),
              sessions: fc.array(sessionEntityArb(campusIds), {
                minLength: 1,
                maxLength: 20,
              }),
              filterCampusId: fc.option(fc.constantFrom(...campusIds), {
                nil: undefined,
              }),
              filterGradeLevel: fc.option(gradeLevelArb, { nil: undefined }),
            }),
          ),
          async ({ sessions, filterCampusId, filterGradeLevel }) => {
            // Compute expected results using reference implementation
            const expected = sessions.filter((s) => {
              if (filterCampusId && s.campusId !== filterCampusId) return false;
              if (filterGradeLevel && s.gradeLevel !== filterGradeLevel)
                return false;
              return true;
            });

            // Mock repository to simulate filter behavior matching the real implementation
            mockSessionRepository.findAll.mockImplementation(
              async (
                query: SessionQueryDto,
              ): Promise<[SessionEntity[], number]> => {
                const filtered = sessions.filter((s) => {
                  if (query.campusId && s.campusId !== query.campusId)
                    return false;
                  if (query.gradeLevel && s.gradeLevel !== query.gradeLevel)
                    return false;
                  return true;
                });
                return [filtered, filtered.length];
              },
            );

            const query = new SessionQueryDto();
            query.page = 1;
            query.limit = 100;
            query.campusId = filterCampusId;
            query.gradeLevel = filterGradeLevel;

            const result = await sessionService.findAll(query, 'school-1');

            // Verify: returned exactly the expected count
            expect(result.data.length).toBe(expected.length);

            // Verify: every returned record matches all filter criteria
            for (const session of result.data) {
              if (filterCampusId) {
                expect(session.campusId).toBe(filterCampusId);
              }
              if (filterGradeLevel) {
                expect(session.gradeLevel).toBe(filterGradeLevel);
              }
            }

            // Verify: completeness — all expected records are present
            const returnedIds = new Set(result.data.map((s) => s.id));
            for (const exp of expected) {
              expect(returnedIds.has(exp.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements 5.5**
     *
     * When no filters are specified, all sessions are returned.
     */
    it('should return all sessions when no filter is applied', async () => {
      await fc.assert(
        fc.asyncProperty(
          campusIdPoolArb.chain((campusIds) =>
            fc.array(sessionEntityArb(campusIds), {
              minLength: 1,
              maxLength: 20,
            }),
          ),
          async (sessions) => {
            mockSessionRepository.findAll.mockImplementation(
              async (): Promise<[SessionEntity[], number]> => {
                return [sessions, sessions.length];
              },
            );

            const query = new SessionQueryDto();
            query.page = 1;
            query.limit = 100;
            // No campusId or gradeLevel filter

            const result = await sessionService.findAll(query, 'school-1');

            expect(result.data.length).toBe(sessions.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Period Definition Filter Tests ───────────────────────────────────────────

  describe('PeriodDefinitionService.findAll filter correctness', () => {
    let periodService: PeriodDefinitionService;
    let mockPeriodRepository: jest.Mocked<PeriodDefinitionRepository>;

    beforeEach(() => {
      mockPeriodRepository = {
        findAll: jest.fn(),
        findById: jest.fn(),
        findBySession: jest.fn(),
        findBySessionAndGradeLevel: jest.fn(),
        findBySchool: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      } as unknown as jest.Mocked<PeriodDefinitionRepository>;

      periodService = new PeriodDefinitionService(mockPeriodRepository);
    });

    /**
     * **Validates: Requirements 6.6**
     *
     * For any set of period definitions and any filter combination of sessionId
     * and/or gradeLevel, the query returns exactly those records matching ALL
     * specified filter criteria.
     */
    it('should return exactly period definitions matching sessionId and/or gradeLevel filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          sessionIdPoolArb.chain((sessionIds) =>
            fc.record({
              sessionIds: fc.constant(sessionIds),
              periods: fc.array(periodDefinitionEntityArb(sessionIds), {
                minLength: 1,
                maxLength: 20,
              }),
              filterSessionId: fc.option(fc.constantFrom(...sessionIds), {
                nil: undefined,
              }),
              filterGradeLevel: fc.option(gradeLevelArb, { nil: undefined }),
            }),
          ),
          async ({ periods, filterSessionId, filterGradeLevel }) => {
            // Compute expected results using reference implementation
            const expected = periods.filter((p) => {
              if (filterSessionId && p.sessionId !== filterSessionId)
                return false;
              if (filterGradeLevel && p.gradeLevel !== filterGradeLevel)
                return false;
              return true;
            });

            // Mock repository to simulate filter behavior matching the real implementation
            mockPeriodRepository.findAll.mockImplementation(
              async (
                query: PeriodDefinitionQueryDto,
              ): Promise<[PeriodDefinitionEntity[], number]> => {
                const filtered = periods.filter((p) => {
                  if (query.sessionId && p.sessionId !== query.sessionId)
                    return false;
                  if (query.gradeLevel && p.gradeLevel !== query.gradeLevel)
                    return false;
                  return true;
                });
                return [filtered, filtered.length];
              },
            );

            const query = new PeriodDefinitionQueryDto();
            query.page = 1;
            query.limit = 100;
            query.sessionId = filterSessionId;
            query.gradeLevel = filterGradeLevel;

            const result = await periodService.findAll(query, 'school-1');

            // Verify: returned exactly the expected count
            expect(result.data.length).toBe(expected.length);

            // Verify: every returned record matches all filter criteria
            for (const period of result.data) {
              if (filterSessionId) {
                expect(period.sessionId).toBe(filterSessionId);
              }
              if (filterGradeLevel) {
                expect(period.gradeLevel).toBe(filterGradeLevel);
              }
            }

            // Verify: completeness — all expected records are present
            const returnedIds = new Set(result.data.map((p) => p.id));
            for (const exp of expected) {
              expect(returnedIds.has(exp.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements 6.6**
     *
     * When no filters are specified, all period definitions are returned.
     */
    it('should return all period definitions when no filter is applied', async () => {
      await fc.assert(
        fc.asyncProperty(
          sessionIdPoolArb.chain((sessionIds) =>
            fc.array(periodDefinitionEntityArb(sessionIds), {
              minLength: 1,
              maxLength: 20,
            }),
          ),
          async (periods) => {
            mockPeriodRepository.findAll.mockImplementation(
              async (): Promise<[PeriodDefinitionEntity[], number]> => {
                return [periods, periods.length];
              },
            );

            const query = new PeriodDefinitionQueryDto();
            query.page = 1;
            query.limit = 100;
            // No sessionId or gradeLevel filter

            const result = await periodService.findAll(query, 'school-1');

            expect(result.data.length).toBe(periods.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements 6.6**
     *
     * When both sessionId and gradeLevel filters are applied, only records
     * matching BOTH criteria are returned (conjunction semantics).
     */
    it('should apply conjunction (AND) semantics when both filters are specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          sessionIdPoolArb.chain((sessionIds) =>
            fc.record({
              sessionIds: fc.constant(sessionIds),
              periods: fc.array(periodDefinitionEntityArb(sessionIds), {
                minLength: 3,
                maxLength: 20,
              }),
              filterSessionId: fc.constantFrom(...sessionIds),
              filterGradeLevel: gradeLevelArb,
            }),
          ),
          async ({ periods, filterSessionId, filterGradeLevel }) => {
            // Expected: must match BOTH criteria
            const expected = periods.filter(
              (p) =>
                p.sessionId === filterSessionId &&
                p.gradeLevel === filterGradeLevel,
            );

            mockPeriodRepository.findAll.mockImplementation(
              async (
                query: PeriodDefinitionQueryDto,
              ): Promise<[PeriodDefinitionEntity[], number]> => {
                const filtered = periods.filter((p) => {
                  if (query.sessionId && p.sessionId !== query.sessionId)
                    return false;
                  if (query.gradeLevel && p.gradeLevel !== query.gradeLevel)
                    return false;
                  return true;
                });
                return [filtered, filtered.length];
              },
            );

            const query = new PeriodDefinitionQueryDto();
            query.page = 1;
            query.limit = 100;
            query.sessionId = filterSessionId;
            query.gradeLevel = filterGradeLevel;

            const result = await periodService.findAll(query, 'school-1');

            // Must match both criteria
            expect(result.data.length).toBe(expected.length);
            for (const period of result.data) {
              expect(period.sessionId).toBe(filterSessionId);
              expect(period.gradeLevel).toBe(filterGradeLevel);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
