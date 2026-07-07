/**
 * Feature: workspace-context-switcher, Properties 1–4, 16: Accessible schools computation
 *
 * Property 1: Single-school role computation — For SCHOOL_ADMIN/HR/SCHEDULER/VIEWER,
 *   result contains at most 1 school matching JWT schoolId
 * Property 2: Teacher accessible schools computation — For TEACHER,
 *   result is exactly the ACTIVE subset of accessibleSchoolIds
 * Property 3: COMPANY_ADMIN accessible schools computation — Result contains
 *   company node + active children
 * Property 4: SUPER_ADMIN computation — Result contains all active schools
 * Property 16: Maximum 50 schools cap — Result never exceeds 50 entries
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 4.3, 7.2, 7.7, 8.2, 8.3, 8.4, 8.7**
 */

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: jest.fn((str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }),
}));

import * as fc from 'fast-check';
import { Logger } from '@nestjs/common';
import { ContextService, ContextJwtUser } from './context.service';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';

describe('Feature: workspace-context-switcher, Properties 1–4, 16: Accessible schools computation', () => {
  let service: ContextService;
  let schoolRepository: { findById: jest.Mock };
  let schoolEntityRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let teacherSchoolAssignmentService: { getAccessibleSchoolIds: jest.Mock };
  let contextSessionService: {
    getActiveContext: jest.Mock;
    setActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
  };
  let auditLogService: { log: jest.Mock };

  // ─── Arbitraries ────────────────────────────────────────────────────────────

  const uuidArb = fc.uuid().map((u) => u.toLowerCase());

  /** Arbitrary for single-school roles */
  const singleSchoolRoleArb = fc.constantFrom(
    UserRole.SCHOOL_ADMIN,
    UserRole.HR,
    UserRole.SCHEDULER,
    UserRole.VIEWER,
  );

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(() => {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    schoolRepository = {
      findById: jest.fn().mockResolvedValue(null),
    };

    schoolEntityRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    teacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    contextSessionService = {
      getActiveContext: jest.fn().mockResolvedValue(null),
      setActiveContext: jest.fn().mockResolvedValue(undefined),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
    };

    auditLogService = {
      log: jest.fn(),
    };

    service = new ContextService(
      schoolRepository as any,
      schoolEntityRepository as any,
      teacherSchoolAssignmentService as any,
      contextSessionService as any,
      auditLogService as any,
      { emit: jest.fn() } as any,
    );

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });


  // ─── Property 1: Single-school role computation ─────────────────────────────

  describe('Property 1: Single-school role computation', () => {
    it('For SCHOOL_ADMIN/HR/SCHEDULER/VIEWER, result contains at most 1 school matching JWT schoolId', async () => {
      await fc.assert(
        fc.asyncProperty(
          singleSchoolRoleArb,
          uuidArb, // userId
          uuidArb, // schoolId from JWT
          fc.constantFrom(SchoolStatus.ACTIVE, SchoolStatus.INACTIVE),
          async (role, userId, schoolId, schoolStatus) => {
            const user: ContextJwtUser = {
              id: userId,
              role,
              schoolId,
              accessibleSchoolIds: [],
            };

            // Mock the school lookup
            const mockSchool = {
              id: schoolId,
              code: 'SC01',
              name: 'Test School',
              status: schoolStatus,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            schoolRepository.findById.mockResolvedValue(mockSchool);

            const result = await service.computeAccessibleSchoolIds(user);

            // Property: result contains at most 1 school
            expect(result.length).toBeLessThanOrEqual(1);

            // If result is non-empty, it must match the JWT schoolId
            if (result.length === 1) {
              expect(result[0]).toBe(schoolId);
            }

            // If school is ACTIVE, result should contain the school
            if (schoolStatus === SchoolStatus.ACTIVE) {
              expect(result).toContain(schoolId);
            }

            // If school is INACTIVE, result should be empty
            if (schoolStatus === SchoolStatus.INACTIVE) {
              expect(result).toHaveLength(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('For single-school roles with null schoolId, result is empty', async () => {
      await fc.assert(
        fc.asyncProperty(singleSchoolRoleArb, uuidArb, async (role, userId) => {
          const user: ContextJwtUser = {
            id: userId,
            role,
            schoolId: null,
            accessibleSchoolIds: [],
          };

          const result = await service.computeAccessibleSchoolIds(user);

          expect(result).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 2: Teacher accessible schools computation ─────────────────────

  describe('Property 2: Teacher accessible schools computation', () => {
    it('For TEACHER, result is exactly the ACTIVE subset of accessibleSchoolIds', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          fc.array(uuidArb, { minLength: 1, maxLength: 20 }), // candidate school IDs
          async (userId, rawSchoolIds) => {
            // Ensure unique IDs
            const uniqueSchoolIds = [...new Set(rawSchoolIds)];

            // Randomly assign statuses — mock will return only ACTIVE ones
            const activeIds = uniqueSchoolIds.filter(
              (_, i) => i % 2 === 0, // Even-indexed schools are ACTIVE
            );

            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: uniqueSchoolIds[0],
              accessibleSchoolIds: uniqueSchoolIds,
            };

            // Mock filterActiveSchoolIds — returns only active subset
            const mockActiveSchools = activeIds.map((id, i) => ({
              id,
              code: `T${i}`,
              name: `School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            schoolEntityRepository.createQueryBuilder.mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockActiveSchools),
            });

            const result = await service.computeAccessibleSchoolIds(user);

            // Property: result is exactly the ACTIVE subset (capped at 50)
            const expectedCapped = activeIds.slice(0, 50);
            expect(result.sort()).toEqual(expectedCapped.sort());

            // Verify no non-active school is in the result
            const inactiveIds = uniqueSchoolIds.filter((_, i) => i % 2 !== 0);
            for (const inactiveId of inactiveIds) {
              expect(result).not.toContain(inactiveId);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('For TEACHER with empty accessibleSchoolIds, falls back to TeacherSchoolAssignment', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          uuidArb, // primary schoolId from JWT
          fc.array(uuidArb, { minLength: 1, maxLength: 10 }), // assignment school IDs
          async (userId, primarySchoolId, rawAssignmentIds) => {
            const uniqueAssignmentIds = [...new Set(rawAssignmentIds)];

            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: primarySchoolId,
              accessibleSchoolIds: [], // Empty — triggers fallback
            };

            // Mock TeacherSchoolAssignmentService
            teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue(
              uniqueAssignmentIds,
            );

            // Mock filterActiveSchoolIds: all assignment schools are ACTIVE
            const mockSchools = uniqueAssignmentIds.map((id, i) => ({
              id,
              code: `A${i}`,
              name: `Assigned School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            schoolEntityRepository.createQueryBuilder.mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockSchools),
            });

            const result = await service.computeAccessibleSchoolIds(user);

            // Property: result contains the assignment school IDs (capped at 50)
            const expected = uniqueAssignmentIds.slice(0, 50);
            expect(result.sort()).toEqual(expected.sort());
            expect(result.length).toBeLessThanOrEqual(50);
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  // ─── Property 3: COMPANY_ADMIN accessible schools computation ───────────────

  describe('Property 3: COMPANY_ADMIN accessible schools computation', () => {
    it('Result contains company node (if ACTIVE) + active children where parentSchoolId = companySchoolId', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          uuidArb, // companySchoolId
          fc.integer({ min: 0, max: 15 }), // number of active children
          fc.constantFrom(SchoolStatus.ACTIVE, SchoolStatus.INACTIVE), // company node status
          async (userId, companySchoolId, numActiveChildren, companyStatus) => {
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.COMPANY_ADMIN,
              schoolId: null,
              companySchoolId,
            };

            // Mock the company school (findById)
            const companySchool = {
              id: companySchoolId,
              code: 'COMP01',
              name: 'Company School',
              status: companyStatus,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;
            schoolRepository.findById.mockResolvedValue(companySchool);

            // Mock children query — schoolEntityRepository.find returns only ACTIVE children
            const activeChildren = Array.from({ length: numActiveChildren }, (_, i) => ({
              id: `child-${i}-${companySchoolId.slice(0, 8)}`,
              code: `CH${i}`,
              name: `Child ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: companySchoolId,
              deletedAt: null,
            }));

            schoolEntityRepository.find.mockResolvedValue(activeChildren);

            const result = await service.computeAccessibleSchoolIds(user);

            // Property 3: company node included if ACTIVE
            if (companyStatus === SchoolStatus.ACTIVE) {
              expect(result).toContain(companySchoolId);
            } else {
              expect(result).not.toContain(companySchoolId);
            }

            // All active children should be in the result
            for (const child of activeChildren) {
              expect(result).toContain(child.id);
            }

            // Result size = company node (if active) + active children, capped at 50
            const expectedSize = Math.min(
              (companyStatus === SchoolStatus.ACTIVE ? 1 : 0) + numActiveChildren,
              50,
            );
            expect(result.length).toBe(expectedSize);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('Result is empty when companySchoolId is null', async () => {
      await fc.assert(
        fc.asyncProperty(uuidArb, async (userId) => {
          const user: ContextJwtUser = {
            id: userId,
            role: UserRole.COMPANY_ADMIN,
            schoolId: null,
            companySchoolId: null,
          };

          const result = await service.computeAccessibleSchoolIds(user);

          expect(result).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });

    it('Result is empty when companySchoolId references non-existent school', async () => {
      await fc.assert(
        fc.asyncProperty(uuidArb, uuidArb, async (userId, companySchoolId) => {
          const user: ContextJwtUser = {
            id: userId,
            role: UserRole.COMPANY_ADMIN,
            schoolId: null,
            companySchoolId,
          };

          // School not found
          schoolRepository.findById.mockResolvedValue(null);

          const result = await service.computeAccessibleSchoolIds(user);

          expect(result).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 4: SUPER_ADMIN accessible schools computation ─────────────────

  describe('Property 4: SUPER_ADMIN accessible schools computation', () => {
    it('Result contains all active schools returned by the repository', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          fc.integer({ min: 0, max: 40 }), // number of active schools
          async (userId, numSchools) => {
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
            };

            // Generate active schools (repo already filters for ACTIVE)
            const schools = Array.from({ length: numSchools }, (_, i) => ({
              id: `school-${i}-${userId.slice(0, 8)}`,
              code: `S${i}`,
              name: `School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            // Mock: find all active schools (repo applies take: 50)
            schoolEntityRepository.find.mockResolvedValue(schools.slice(0, 50));

            const result = await service.computeAccessibleSchoolIds(user);

            // Property: result contains all provided active schools (capped at 50)
            const expected = schools.slice(0, 50).map((s) => s.id);
            expect(result).toEqual(expected);

            // Verify every returned ID corresponds to a school in the mock
            for (const id of result) {
              expect(schools.map((s) => s.id)).toContain(id);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('Result contains only ACTIVE schools (INACTIVE schools excluded by repo filter)', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.integer({ min: 1, max: 30 }), // total schools
          fc.integer({ min: 0, max: 30 }), // num active
          async (userId, totalSchools, numActive) => {
            const actualActive = Math.min(numActive, totalSchools);

            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
            };

            // Only active schools returned by repository (it already filters)
            const activeSchools = Array.from({ length: actualActive }, (_, i) => ({
              id: `active-school-${i}`,
              code: `AS${i}`,
              name: `Active School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            schoolEntityRepository.find.mockResolvedValue(activeSchools.slice(0, 50));

            const result = await service.computeAccessibleSchoolIds(user);

            // Property: all results are IDs of active schools
            expect(result.length).toBe(Math.min(actualActive, 50));
            for (const id of result) {
              expect(activeSchools.map((s) => s.id)).toContain(id);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  // ─── Property 16: Maximum 50 schools cap ────────────────────────────────────

  describe('Property 16: Maximum 50 schools cap', () => {
    it('SUPER_ADMIN result never exceeds 50 entries even with many active schools', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.integer({ min: 1, max: 100 }), // number of active schools in system
          async (userId, numSchools) => {
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
            };

            // Generate schools — repo already applies `take: 50`
            const schools = Array.from(
              { length: Math.min(numSchools, 50) },
              (_, i) => ({
                id: `school-${i}-${userId.slice(0, 8)}`,
                code: `S${i}`,
                name: `School ${i}`,
                status: SchoolStatus.ACTIVE,
                parentSchoolId: null,
                deletedAt: null,
              }),
            );

            schoolEntityRepository.find.mockResolvedValue(schools);

            const result = await service.computeAccessibleSchoolIds(user);

            // Property 16: result never exceeds 50
            expect(result.length).toBeLessThanOrEqual(50);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('TEACHER result never exceeds 50 entries even with many accessibleSchoolIds', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(uuidArb, { minLength: 40, maxLength: 70 }), // more than 50 school IDs
          async (userId, rawSchoolIds) => {
            const uniqueIds = [...new Set(rawSchoolIds)];
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: uniqueIds[0],
              accessibleSchoolIds: uniqueIds,
            };

            // All schools are ACTIVE
            const mockSchools = uniqueIds.map((id, i) => ({
              id,
              code: `T${i}`,
              name: `Teacher School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            schoolEntityRepository.createQueryBuilder.mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockSchools),
            });

            const result = await service.computeAccessibleSchoolIds(user);

            // Property 16: result never exceeds 50
            expect(result.length).toBeLessThanOrEqual(50);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('COMPANY_ADMIN result never exceeds 50 entries even with many children', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          fc.integer({ min: 40, max: 70 }), // number of children
          async (userId, companySchoolId, numChildren) => {
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.COMPANY_ADMIN,
              schoolId: null,
              companySchoolId,
            };

            // Company node is ACTIVE
            const companySchool = {
              id: companySchoolId,
              code: 'COMP01',
              name: 'Company',
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;
            schoolRepository.findById.mockResolvedValue(companySchool);

            // Generate many active children
            const children = Array.from({ length: numChildren }, (_, i) => ({
              id: `child-${i}-${userId.slice(0, 8)}`,
              code: `CH${i}`,
              name: `Child ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: companySchoolId,
              deletedAt: null,
            }));
            schoolEntityRepository.find.mockResolvedValue(children);

            const result = await service.computeAccessibleSchoolIds(user);

            // Property 16: result never exceeds 50
            expect(result.length).toBeLessThanOrEqual(50);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
