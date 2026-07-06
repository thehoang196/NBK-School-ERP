/**
 * Feature: academic-structure, Property 7: Session Campus-Grade-Level Existence Validation
 *
 * **Validates: Requirements 5.3**
 *
 * For any session creation request with a (campus_id, grade_level) pair,
 * the service SHALL accept the request if and only if a corresponding active
 * record exists in the campus_grade_levels table.
 */
import * as fc from 'fast-check';
import { SessionService } from '../../services/session.service';
import { SessionRepository } from '../../repositories/session.repository';
import { CampusGradeLevelRepository } from '../../repositories/campus-grade-level.repository';
import { CampusGradeLevelNotFoundException } from '../../exceptions';
import { GradeLevel } from '../../enums';
import { CampusGradeLevelEntity } from '../../entities/campus-grade-level.entity';
import { SessionEntity } from '../../entities/session.entity';
import { CreateSessionDto } from '../../dto/session/create-session.dto';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const gradeLevelArb: fc.Arbitrary<GradeLevel> = fc.constantFrom(
  GradeLevel.PRIMARY,
  GradeLevel.MIDDLE_SCHOOL,
  GradeLevel.HIGH_SCHOOL,
);

/**
 * Generates valid military time strings (HH:mm) for session start/end times.
 * Ensures startTime < endTime by generating hour pairs where start < end.
 */
const timeRangeArb: fc.Arbitrary<{ startTime: string; endTime: string }> = fc
  .integer({ min: 0, max: 22 })
  .chain((startHour) =>
    fc.integer({ min: startHour + 1, max: 23 }).map((endHour) => ({
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(endHour).padStart(2, '0')}:00`,
    })),
  );

const sessionNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0);

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: academic-structure, Property 7: Session Campus-Grade-Level Existence Validation', () => {
  let service: SessionService;
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

    service = new SessionService(
      mockSessionRepository,
      mockCampusGradeLevelRepository,
    );
  });

  /**
   * **Validates: Requirements 5.3**
   *
   * When a (campusId, gradeLevel) pair exists as an active record in campus_grade_levels,
   * session creation SHALL succeed (not throw CampusGradeLevelNotFoundException).
   */
  it('should accept session creation when campus-grade-level exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // campusId
        gradeLevelArb, // gradeLevel
        fc.uuid(), // schoolId
        timeRangeArb, // { startTime, endTime }
        sessionNameArb, // name
        fc.integer({ min: 0, max: 100 }), // sortOrder
        async (campusId, gradeLevel, schoolId, timeRange, name, sortOrder) => {
          // Reset mocks
          mockCampusGradeLevelRepository.findByCampusAndGrade.mockReset();
          mockSessionRepository.create.mockReset();

          // Simulate: campus-grade-level record EXISTS
          const existingCgl: Partial<CampusGradeLevelEntity> = {
            id: fc.sample(fc.uuid(), 1)[0],
            campusId,
            gradeLevel,
            schoolId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          mockCampusGradeLevelRepository.findByCampusAndGrade.mockResolvedValueOnce(
            existingCgl as CampusGradeLevelEntity,
          );

          // Simulate: session created successfully
          const createdSession: Partial<SessionEntity> = {
            id: fc.sample(fc.uuid(), 1)[0],
            schoolId,
            campusId,
            gradeLevel,
            name,
            startTime: timeRange.startTime,
            endTime: timeRange.endTime,
            sortOrder,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          mockSessionRepository.create.mockResolvedValueOnce(
            createdSession as SessionEntity,
          );

          const dto: CreateSessionDto = {
            campusId,
            gradeLevel,
            name,
            startTime: timeRange.startTime,
            endTime: timeRange.endTime,
            sortOrder,
          };

          // Should NOT throw CampusGradeLevelNotFoundException
          const result = await service.create(dto, schoolId);

          expect(result).toBeDefined();
          expect(result.campusId).toBe(campusId);
          expect(result.gradeLevel).toBe(gradeLevel);
          expect(
            mockCampusGradeLevelRepository.findByCampusAndGrade,
          ).toHaveBeenCalledWith(campusId, gradeLevel, schoolId);
          expect(mockSessionRepository.create).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.3**
   *
   * When a (campusId, gradeLevel) pair does NOT exist in campus_grade_levels,
   * session creation SHALL throw CampusGradeLevelNotFoundException.
   */
  it('should throw CampusGradeLevelNotFoundException when campus-grade-level does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // campusId
        gradeLevelArb, // gradeLevel
        fc.uuid(), // schoolId
        timeRangeArb, // { startTime, endTime }
        sessionNameArb, // name
        fc.integer({ min: 0, max: 100 }), // sortOrder
        async (campusId, gradeLevel, schoolId, timeRange, name, sortOrder) => {
          // Reset mocks
          mockCampusGradeLevelRepository.findByCampusAndGrade.mockReset();
          mockSessionRepository.create.mockReset();

          // Simulate: campus-grade-level record DOES NOT EXIST
          mockCampusGradeLevelRepository.findByCampusAndGrade.mockResolvedValueOnce(
            null,
          );

          const dto: CreateSessionDto = {
            campusId,
            gradeLevel,
            name,
            startTime: timeRange.startTime,
            endTime: timeRange.endTime,
            sortOrder,
          };

          // Should throw CampusGradeLevelNotFoundException
          await expect(service.create(dto, schoolId)).rejects.toThrow(
            CampusGradeLevelNotFoundException,
          );

          // Verify that repository.create was NEVER called
          expect(mockSessionRepository.create).not.toHaveBeenCalled();
          expect(
            mockCampusGradeLevelRepository.findByCampusAndGrade,
          ).toHaveBeenCalledWith(campusId, gradeLevel, schoolId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.3**
   *
   * The biconditional property: for any (campusId, gradeLevel) and any boolean
   * "exists" flag, the session creation result is deterministically governed by
   * whether the campus-grade-level exists or not.
   */
  it('should accept if and only if campus-grade-level exists (biconditional)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // campusId
        gradeLevelArb, // gradeLevel
        fc.uuid(), // schoolId
        timeRangeArb, // { startTime, endTime }
        sessionNameArb, // name
        fc.boolean(), // exists: whether CGL record exists
        async (campusId, gradeLevel, schoolId, timeRange, name, exists) => {
          // Reset mocks
          mockCampusGradeLevelRepository.findByCampusAndGrade.mockReset();
          mockSessionRepository.create.mockReset();

          if (exists) {
            // CGL exists
            const cglRecord: Partial<CampusGradeLevelEntity> = {
              id: fc.sample(fc.uuid(), 1)[0],
              campusId,
              gradeLevel,
              schoolId,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            };
            mockCampusGradeLevelRepository.findByCampusAndGrade.mockResolvedValueOnce(
              cglRecord as CampusGradeLevelEntity,
            );

            const createdSession: Partial<SessionEntity> = {
              id: fc.sample(fc.uuid(), 1)[0],
              schoolId,
              campusId,
              gradeLevel,
              name,
              startTime: timeRange.startTime,
              endTime: timeRange.endTime,
              sortOrder: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            };
            mockSessionRepository.create.mockResolvedValueOnce(
              createdSession as SessionEntity,
            );
          } else {
            // CGL does NOT exist
            mockCampusGradeLevelRepository.findByCampusAndGrade.mockResolvedValueOnce(
              null,
            );
          }

          const dto: CreateSessionDto = {
            campusId,
            gradeLevel,
            name,
            startTime: timeRange.startTime,
            endTime: timeRange.endTime,
          };

          if (exists) {
            // Should succeed
            const result = await service.create(dto, schoolId);
            expect(result).toBeDefined();
            expect(mockSessionRepository.create).toHaveBeenCalled();
          } else {
            // Should throw
            await expect(service.create(dto, schoolId)).rejects.toThrow(
              CampusGradeLevelNotFoundException,
            );
            expect(mockSessionRepository.create).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
