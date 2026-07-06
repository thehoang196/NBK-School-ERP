/**
 * Feature: academic-structure, Property 5: Campus-Grade-Level Uniqueness
 *
 * **Validates: Requirements 3.3, 3.5**
 *
 * For any campus and grade level combination, attempting to create a second active
 * `campus_grade_levels` record with the same `(campus_id, grade_level)` SHALL always
 * result in a conflict error, regardless of which specific campus or grade level values are used.
 */
import * as fc from 'fast-check';
import { CampusGradeLevelService } from '../../services/campus-grade-level.service';
import { CampusGradeLevelRepository } from '../../repositories/campus-grade-level.repository';
import { CampusGradeLevelExistsException } from '../../exceptions';
import { GradeLevel } from '../../enums';
import { CampusGradeLevelEntity } from '../../entities/campus-grade-level.entity';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const gradeLevelArb: fc.Arbitrary<GradeLevel> = fc.constantFrom(
  GradeLevel.PRIMARY,
  GradeLevel.MIDDLE_SCHOOL,
  GradeLevel.HIGH_SCHOOL,
);

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: academic-structure, Property 5: Campus-Grade-Level Uniqueness', () => {
  let service: CampusGradeLevelService;
  let mockRepository: jest.Mocked<CampusGradeLevelRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findByCampusAndGrade: jest.fn(),
      findByCampus: jest.fn(),
      findByGradeLevel: jest.fn(),
      findAllBySchool: jest.fn(),
      findById: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<CampusGradeLevelRepository>;

    service = new CampusGradeLevelService(mockRepository);
  });

  /**
   * **Validates: Requirements 3.3, 3.5**
   *
   * For any (campusId, gradeLevel, schoolId) combination:
   * - First assign should succeed (no existing record found)
   * - Second assign with the same params should throw CampusGradeLevelExistsException
   */
  it('should throw CampusGradeLevelExistsException when assigning duplicate (campusId, gradeLevel)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // campusId
        gradeLevelArb, // gradeLevel
        fc.uuid(), // schoolId
        async (campusId, gradeLevel, schoolId) => {
          // Reset mocks for each iteration
          mockRepository.findByCampusAndGrade.mockReset();
          mockRepository.create.mockReset();

          // --- First assign: no existing record ---
          mockRepository.findByCampusAndGrade.mockResolvedValueOnce(null);
          const createdEntity: Partial<CampusGradeLevelEntity> = {
            id: fc.sample(fc.uuid(), 1)[0],
            campusId,
            gradeLevel,
            schoolId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          mockRepository.create.mockResolvedValueOnce(
            createdEntity as CampusGradeLevelEntity,
          );

          const result = await service.assign(
            { campusId, gradeLevel },
            schoolId,
          );

          expect(result).toBeDefined();
          expect(result.campusId).toBe(campusId);
          expect(result.gradeLevel).toBe(gradeLevel);
          expect(mockRepository.findByCampusAndGrade).toHaveBeenCalledWith(
            campusId,
            gradeLevel,
            schoolId,
          );
          expect(mockRepository.create).toHaveBeenCalledWith({
            campusId,
            gradeLevel,
            schoolId,
          });

          // --- Second assign: existing record found ---
          mockRepository.findByCampusAndGrade.mockResolvedValueOnce(
            createdEntity as CampusGradeLevelEntity,
          );

          await expect(
            service.assign({ campusId, gradeLevel }, schoolId),
          ).rejects.toThrow(CampusGradeLevelExistsException);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.3, 3.5**
   *
   * For any existing active campus-grade-level record, attempting to assign
   * the same combination SHALL always be rejected regardless of the values.
   */
  it('should always reject duplicate assignment regardless of specific campusId and gradeLevel values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // campusId
        gradeLevelArb, // gradeLevel
        fc.uuid(), // schoolId
        fc.uuid(), // existing record id
        async (campusId, gradeLevel, schoolId, existingId) => {
          mockRepository.findByCampusAndGrade.mockReset();
          mockRepository.create.mockReset();

          // Simulate that an active record already exists
          const existingRecord: Partial<CampusGradeLevelEntity> = {
            id: existingId,
            campusId,
            gradeLevel,
            schoolId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          mockRepository.findByCampusAndGrade.mockResolvedValueOnce(
            existingRecord as CampusGradeLevelEntity,
          );

          // Attempt to assign the same combination should always throw
          await expect(
            service.assign({ campusId, gradeLevel }, schoolId),
          ).rejects.toThrow(CampusGradeLevelExistsException);

          // Verify repository.create was never called
          expect(mockRepository.create).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
