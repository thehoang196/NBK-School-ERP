/**
 * Feature: workspace-context-switcher, Property 7: No information leakage
 *
 * For any API response from the context endpoints, the response SHALL NOT
 * contain the ID, name, code, count, or any attribute of schools that are
 * not in the requesting user's computed accessible schools list.
 *
 * Also verifies that error messages from switch to inaccessible schools
 * don't leak school info (generic 403 message only).
 *
 * **Validates: Requirements 1.9, 4.6, 10.4, 10.5**
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
import { ContextForbiddenException } from '../exceptions/context.exceptions';

describe('Feature: workspace-context-switcher, Property 7: No information leakage', () => {
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

  /** Arbitrary for a school entity object */
  const schoolArb = (id: string) =>
    fc.record({
      id: fc.constant(id),
      code: fc.string({ minLength: 2, maxLength: 10 }).map((s) => s.replace(/[^a-zA-Z0-9]/g, 'X').slice(0, 10) || 'SC'),
      name: fc.string({ minLength: 3, maxLength: 50 }).map((s) => s.replace(/\n/g, ' ').trim() || 'School'),
      status: fc.constant(SchoolStatus.ACTIVE),
      parentSchoolId: fc.constant(null),
      deletedAt: fc.constant(null),
    });

  /** Arbitrary for multi-school roles */
  const multiSchoolRoleArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.TEACHER,
  );

  /** Arbitrary for any role */
  const anyRoleArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.TEACHER,
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

  // ─── Property 7a: getAccessibleSchools response contains ONLY accessible schools ───

  describe('Property 7a: getAccessibleSchools response contains only schools from accessible set', () => {
    it('response SHALL NOT contain ID, name, or code of any inaccessible school', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          // Generate accessible school IDs (subset)
          fc.array(uuidArb, { minLength: 1, maxLength: 10 }).chain((accessibleIds) => {
            // Generate inaccessible school IDs (disjoint set)
            return fc.array(uuidArb, { minLength: 1, maxLength: 10 }).map(
              (inaccessibleIds) => {
                // Ensure disjoint by filtering out any overlap
                const uniqueAccessible = [...new Set(accessibleIds)];
                const accessibleSet = new Set(uniqueAccessible);
                const uniqueInaccessible = [...new Set(inaccessibleIds)].filter(
                  (id) => !accessibleSet.has(id),
                );
                return { accessibleIds: uniqueAccessible, inaccessibleIds: uniqueInaccessible };
              },
            );
          }),
          async (userId, { accessibleIds, inaccessibleIds }) => {
            // Skip if inaccessible set ended up empty after dedup
            if (inaccessibleIds.length === 0) return;

            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
            };

            // Mock: computeAccessibleSchoolIds returns only accessible IDs
            // For SUPER_ADMIN, schoolEntityRepository.find returns active schools
            const accessibleSchools = accessibleIds.map((id, i) => ({
              id,
              code: `ACC${i}`,
              name: `Accessible School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            // Inaccessible schools exist in the DB but should NOT be returned
            const inaccessibleSchools = inaccessibleIds.map((id, i) => ({
              id,
              code: `INACC${i}`,
              name: `Inaccessible School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            // computeAccessibleSchoolIds (SUPER_ADMIN) calls schoolEntityRepository.find
            // with take: 50 — mock returns only accessible schools
            schoolEntityRepository.find.mockResolvedValue(accessibleSchools);

            // findSchoolIdsWithChildren (called during getAccessibleSchools)
            // needs the createQueryBuilder to return getRawMany with empty set
            schoolEntityRepository.createQueryBuilder.mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
              getRawMany: jest.fn().mockResolvedValue([]),
            });

            const result = await service.getAccessibleSchools(user);

            // PROPERTY: response contains ONLY schools from the accessible set
            const responseIds = result.schools.map((s) => s.id);
            const responseNames = result.schools.map((s) => s.name);
            const responseCodes = result.schools.map((s) => s.code);

            // Verify no inaccessible school ID appears in response
            for (const inaccessibleId of inaccessibleIds) {
              expect(responseIds).not.toContain(inaccessibleId);
            }

            // Verify no inaccessible school name appears in response
            for (const inaccessibleSchool of inaccessibleSchools) {
              expect(responseNames).not.toContain(inaccessibleSchool.name);
              expect(responseCodes).not.toContain(inaccessibleSchool.code);
            }

            // Verify all returned schools are from the accessible set
            for (const school of result.schools) {
              expect(accessibleIds).toContain(school.id);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 7b: TEACHER accessible schools response leaks nothing about other schools ───

  describe('Property 7b: TEACHER response contains only their accessible schools', () => {
    it('TEACHER response SHALL NOT leak any attributes of schools outside accessibleSchoolIds', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          fc.array(uuidArb, { minLength: 1, maxLength: 8 }), // accessible school IDs
          fc.array(uuidArb, { minLength: 1, maxLength: 8 }), // all schools in DB (superset)
          async (userId, rawAccessibleIds, rawAllDbIds) => {
            const accessibleIds = [...new Set(rawAccessibleIds)];
            const accessibleSet = new Set(accessibleIds);

            // All DB IDs: union of accessible + some extras
            const allDbIds = [...new Set([...accessibleIds, ...rawAllDbIds])];
            const inaccessibleIds = allDbIds.filter((id) => !accessibleSet.has(id));

            // Skip if no inaccessible schools
            if (inaccessibleIds.length === 0) return;

            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: accessibleIds[0],
              accessibleSchoolIds: accessibleIds,
            };

            // Mock filterActiveSchoolIds: all accessible schools are ACTIVE
            const accessibleSchools = accessibleIds.map((id, i) => ({
              id,
              code: `TACC${i}`,
              name: `Teacher Accessible ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            const inaccessibleSchools = inaccessibleIds.map((id, i) => ({
              id,
              code: `TINACC${i}`,
              name: `Teacher Inaccessible ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            // computeAccessibleSchoolIds for TEACHER: createQueryBuilder returns only accessible
            const mockQueryBuilder = {
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(accessibleSchools),
              getRawMany: jest.fn().mockResolvedValue([]),
            };
            schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            // getAccessibleSchools also calls schoolEntityRepository.find for the school details
            schoolEntityRepository.find.mockResolvedValue(accessibleSchools);

            const result = await service.getAccessibleSchools(user);

            // PROPERTY: no inaccessible school info leaks
            const responseIds = result.schools.map((s) => s.id);
            const responseNames = result.schools.map((s) => s.name);
            const responseCodes = result.schools.map((s) => s.code);

            for (const inaccessibleSchool of inaccessibleSchools) {
              expect(responseIds).not.toContain(inaccessibleSchool.id);
              expect(responseNames).not.toContain(inaccessibleSchool.name);
              expect(responseCodes).not.toContain(inaccessibleSchool.code);
            }

            // All returned schools must be from accessible set
            for (const school of result.schools) {
              expect(accessibleSet.has(school.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 7c: Switch to inaccessible school returns generic 403 — no info leakage ───

  describe('Property 7c: Switch to inaccessible school error message contains no school info', () => {
    it('403 error response SHALL NOT contain the target school name, code, or any identifying info', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          uuidArb, // accessible school ID
          uuidArb, // inaccessible target school ID
          fc.string({ minLength: 3, maxLength: 30 }).map((s) => s.replace(/\n/g, '').trim() || 'Secret School'),
          fc.string({ minLength: 2, maxLength: 10 }).map((s) => s.replace(/[^a-zA-Z0-9]/g, 'X').slice(0, 10) || 'SEC'),
          async (userId, accessibleId, targetId, targetName, targetCode) => {
            // Ensure target is different from accessible
            if (targetId === accessibleId) return;

            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SCHOOL_ADMIN,
              schoolId: accessibleId,
              accessibleSchoolIds: [],
            };

            // Mock: the user's accessible school
            const accessibleSchool = {
              id: accessibleId,
              code: 'MYSCHOOL',
              name: 'My School',
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;
            schoolRepository.findById.mockResolvedValue(accessibleSchool);

            // The target school exists in DB with its own name/code
            // BUT since the user can't access it, none of this info should leak
            const targetSchool = {
              id: targetId,
              code: targetCode,
              name: targetName,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            try {
              await service.switchContext(user, targetId, '127.0.0.1');
              // If no exception, the test still passes (shouldn't reach here for inaccessible)
              // but we expect it to throw
              fail('Expected ContextForbiddenException to be thrown');
            } catch (error) {
              // PROPERTY: error is ContextForbiddenException with generic message
              expect(error).toBeInstanceOf(ContextForbiddenException);

              // Get error response
              const response = (error as ContextForbiddenException).getResponse();
              const responseStr = JSON.stringify(response);

              // PROPERTY: error response does NOT contain the target school's name
              if (targetName.length >= 3) {
                expect(responseStr).not.toContain(targetName);
              }

              // PROPERTY: error response does NOT contain the target school's code
              if (targetCode.length >= 2) {
                expect(responseStr).not.toContain(targetCode);
              }

              // PROPERTY: error response does NOT contain the target school's ID
              expect(responseStr).not.toContain(targetId);

              // PROPERTY: error message is the generic forbidden message
              const responseObj = response as Record<string, unknown>;
              expect(responseObj.message).toBe(
                'Bạn không có quyền truy cập trường này',
              );
              expect(responseObj.errorCode).toBe('CONTEXT_FORBIDDEN');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 7d: Response does not reveal total school count ───────────────

  describe('Property 7d: Response does not reveal total school count in the system', () => {
    it('accessible schools response SHALL NOT contain pagination metadata revealing total schools count', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          fc.integer({ min: 1, max: 10 }), // number of accessible schools
          fc.integer({ min: 11, max: 50 }), // total schools in system (more than accessible)
          async (userId, numAccessible, totalInSystem) => {
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
            };

            // Generate only the accessible schools (from SUPER_ADMIN perspective, capped)
            const accessibleSchools = Array.from(
              { length: numAccessible },
              (_, i) => ({
                id: `school-${i}-${userId.slice(0, 8)}`,
                code: `S${i}`,
                name: `School ${i}`,
                status: SchoolStatus.ACTIVE,
                parentSchoolId: null,
                deletedAt: null,
              }),
            );

            schoolEntityRepository.find.mockResolvedValue(accessibleSchools);
            schoolEntityRepository.createQueryBuilder.mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
              getRawMany: jest.fn().mockResolvedValue([]),
            });

            const result = await service.getAccessibleSchools(user);

            // PROPERTY: response only contains schools array and canSwitch boolean
            // No total count, no pagination metadata revealing system-wide info
            const resultStr = JSON.stringify(result);

            // Result should not contain a "total" or "totalCount" or "count" field
            // that reveals how many schools exist beyond the accessible ones
            expect(result).not.toHaveProperty('total');
            expect(result).not.toHaveProperty('totalCount');
            expect(result).not.toHaveProperty('meta');

            // Response structure is strictly { schools: [...], canSwitch: boolean }
            const keys = Object.keys(result);
            expect(keys.sort()).toEqual(['canSwitch', 'schools']);

            // Number of schools returned equals the accessible count
            expect(result.schools.length).toBe(numAccessible);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 7e: getAccessibleSchools for any role never leaks inaccessible school data ───

  describe('Property 7e: For arbitrary accessible/inaccessible partition, no leakage occurs', () => {
    it('given any set of "all schools in DB" and a subset of "accessible schools", response contains ONLY the subset', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          // Generate disjoint accessible and inaccessible school sets
          fc.tuple(
            fc.array(uuidArb, { minLength: 1, maxLength: 8 }),
            fc.array(uuidArb, { minLength: 1, maxLength: 8 }),
          ),
          async (userId, [rawAccessible, rawInaccessible]) => {
            const accessibleIds = [...new Set(rawAccessible)];
            const accessibleSet = new Set(accessibleIds);
            // Remove overlap from inaccessible
            const inaccessibleIds = [...new Set(rawInaccessible)].filter(
              (id) => !accessibleSet.has(id),
            );

            if (inaccessibleIds.length === 0) return;

            // Use COMPANY_ADMIN to test a different computation path
            const companySchoolId = accessibleIds[0];
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.COMPANY_ADMIN,
              schoolId: null,
              companySchoolId,
            };

            // Mock: company school is ACTIVE
            const companySchool = {
              id: companySchoolId,
              code: 'COMP',
              name: 'Company Node',
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;
            schoolRepository.findById.mockResolvedValue(companySchool);

            // Mock: children are the rest of accessible schools
            const childSchools = accessibleIds.slice(1).map((id, i) => ({
              id,
              code: `CHILD${i}`,
              name: `Child School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: companySchoolId,
              deletedAt: null,
            }));
            // First call to find = children for COMPANY_ADMIN
            // Second call to find = school details for getAccessibleSchools
            const allAccessibleSchoolEntities = [
              companySchool,
              ...childSchools,
            ];

            schoolEntityRepository.find
              .mockResolvedValueOnce(childSchools) // computeCompanyAdminAccess
              .mockResolvedValueOnce(allAccessibleSchoolEntities); // getAccessibleSchools school detail query

            schoolEntityRepository.createQueryBuilder.mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
              getRawMany: jest.fn().mockResolvedValue([]),
            });

            const result = await service.getAccessibleSchools(user);

            // PROPERTY: no inaccessible school data appears in result
            const responseIds = result.schools.map((s) => s.id);
            for (const inaccessibleId of inaccessibleIds) {
              expect(responseIds).not.toContain(inaccessibleId);
            }

            // All returned IDs are from the accessible set
            for (const school of result.schools) {
              expect(accessibleSet.has(school.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
