/**
 * Feature: workspace-context-switcher, Property 8: Context switch access validation
 *
 * Property 8: For any context switch request where the target schoolId is not present
 * in the user's computed accessible schools list, the system SHALL return HTTP 403 with
 * generic message "Bạn không có quyền truy cập trường này" regardless of whether the
 * school exists in the database.
 *
 * **Validates: Requirements 2.6, 9.3, 10.2, 10.4**
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
import { ForbiddenException, Logger } from '@nestjs/common';
import { ContextService, ContextJwtUser } from './context.service';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { ContextForbiddenException } from '../exceptions/context.exceptions';

describe('Feature: workspace-context-switcher, Property 8: Context switch access validation', () => {
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

  /** Arbitrary for all user roles */
  const allRolesArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.HR,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
    UserRole.VIEWER,
  );

  /** Arbitrary for a list of accessible school IDs (the user's computed list) */
  const accessibleSchoolIdsArb = fc.array(uuidArb, { minLength: 0, maxLength: 10 });

  /** Arbitrary for an IP address */
  const ipArb = fc.tuple(
    fc.integer({ min: 1, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

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

  // ─── Property 8: Context switch access validation ───────────────────────────

  describe('Property 8: Switch to inaccessible school always returns 403 with generic message', () => {
    it('should throw ContextForbiddenException when target schoolId is NOT in accessible list, regardless of school existence in DB', async () => {
      await fc.assert(
        fc.asyncProperty(
          allRolesArb,
          uuidArb, // userId
          uuidArb, // targetSchoolId (the school user wants to switch to)
          accessibleSchoolIdsArb, // user's accessible schools (will NOT contain target)
          fc.boolean(), // whether the target school exists in DB
          fc.constantFrom(SchoolStatus.ACTIVE, SchoolStatus.INACTIVE), // target school status if exists
          ipArb, // IP address
          async (role, userId, targetSchoolId, rawAccessibleIds, schoolExistsInDb, schoolStatus, ip) => {
            // IMPORTANT: Ensure the target is NOT in the accessible list
            const accessibleIds = rawAccessibleIds.filter((id) => id !== targetSchoolId);

            const user: ContextJwtUser = {
              id: userId,
              role,
              schoolId: accessibleIds.length > 0 ? accessibleIds[0] : null,
              accessibleSchoolIds: accessibleIds,
              companySchoolId: role === UserRole.COMPANY_ADMIN ? accessibleIds[0] ?? null : null,
            };

            // ─── Mock computeAccessibleSchoolIds internals ────────────────────────
            // We need to set up mocks so that computeAccessibleSchoolIds returns
            // the accessible IDs that do NOT include the target.
            setupAccessibleSchoolMocks(role, user, accessibleIds);

            // ─── Mock school existence in DB (should NOT matter for result) ────
            if (schoolExistsInDb) {
              schoolRepository.findById.mockImplementation((id: string) => {
                if (id === targetSchoolId) {
                  return Promise.resolve({
                    id: targetSchoolId,
                    code: 'TARGET01',
                    name: 'Target School',
                    status: schoolStatus,
                    parentSchoolId: null,
                    deletedAt: null,
                  } as unknown as SchoolEntity);
                }
                // Return accessible school if looked up during compute
                if (accessibleIds.includes(id)) {
                  return Promise.resolve({
                    id,
                    code: 'ACC01',
                    name: 'Accessible School',
                    status: SchoolStatus.ACTIVE,
                    parentSchoolId: null,
                    deletedAt: null,
                  } as unknown as SchoolEntity);
                }
                return Promise.resolve(null);
              });
            } else {
              schoolRepository.findById.mockImplementation((id: string) => {
                if (accessibleIds.includes(id)) {
                  return Promise.resolve({
                    id,
                    code: 'ACC01',
                    name: 'Accessible School',
                    status: SchoolStatus.ACTIVE,
                    parentSchoolId: null,
                    deletedAt: null,
                  } as unknown as SchoolEntity);
                }
                return Promise.resolve(null);
              });
            }

            // ─── Execute switchContext — should ALWAYS throw 403 ──────────────
            let thrownError: any = null;
            try {
              await service.switchContext(user, targetSchoolId, ip);
            } catch (error) {
              thrownError = error;
            }

            // ─── Assertions ───────────────────────────────────────────────────
            // Property 8: Must always throw ContextForbiddenException (HTTP 403)
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(ForbiddenException);

            // Verify it's specifically a ContextForbiddenException with the correct generic message
            const response = thrownError.getResponse();
            expect(response.message).toBe('Bạn không có quyền truy cập trường này');
            expect(response.errorCode).toBe('CONTEXT_FORBIDDEN');

            // HTTP status must be 403
            expect(thrownError.getStatus()).toBe(403);

            // The response must NOT reveal whether the school exists in the database
            // (generic message regardless of existence — no 404 leak)
            expect(response.message).not.toContain('không tồn tại');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should throw 403 with same generic message whether target school exists or not (no information leakage)', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          uuidArb, // targetSchoolId
          fc.array(uuidArb, { minLength: 1, maxLength: 5 }), // accessible schools
          ipArb,
          async (userId, targetSchoolId, rawAccessibleIds, ip) => {
            // Ensure target is NOT in accessible list
            const accessibleIds = rawAccessibleIds.filter((id) => id !== targetSchoolId);
            if (accessibleIds.length === 0) return; // Skip if all filtered out

            // Test with TEACHER role (multi-school capable)
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: accessibleIds[0],
              accessibleSchoolIds: accessibleIds,
            };

            // Mock for computeAccessibleSchoolIds → returns only accessible IDs
            const mockActiveSchools = accessibleIds.map((id, i) => ({
              id,
              code: `S${i}`,
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

            // ─── Case 1: School EXISTS in DB but not accessible ─────────────
            schoolRepository.findById.mockImplementation((id: string) => {
              if (id === targetSchoolId) {
                return Promise.resolve({
                  id: targetSchoolId,
                  code: 'EXISTS',
                  name: 'Existing School',
                  status: SchoolStatus.ACTIVE,
                  parentSchoolId: null,
                  deletedAt: null,
                } as unknown as SchoolEntity);
              }
              return Promise.resolve(null);
            });

            let error1: any = null;
            try {
              await service.switchContext(user, targetSchoolId, ip);
            } catch (e) {
              error1 = e;
            }

            // ─── Case 2: School DOES NOT exist in DB ────────────────────────
            schoolRepository.findById.mockResolvedValue(null);

            let error2: any = null;
            try {
              await service.switchContext(user, targetSchoolId, ip);
            } catch (e) {
              error2 = e;
            }

            // ─── Both cases must produce IDENTICAL error response ────────────
            expect(error1).not.toBeNull();
            expect(error2).not.toBeNull();

            expect(error1.getStatus()).toBe(403);
            expect(error2.getStatus()).toBe(403);

            const response1 = error1.getResponse();
            const response2 = error2.getResponse();

            // Same message — no way to distinguish school existence
            expect(response1.message).toBe(response2.message);
            expect(response1.message).toBe('Bạn không có quyền truy cập trường này');
            expect(response1.errorCode).toBe(response2.errorCode);
            expect(response1.errorCode).toBe('CONTEXT_FORBIDDEN');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never allow context switch to succeed when target is not in accessible schools', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          uuidArb, // targetSchoolId
          fc.array(uuidArb, { minLength: 1, maxLength: 8 }), // accessible schools
          ipArb,
          async (userId, targetSchoolId, rawAccessibleIds, ip) => {
            // Ensure target is NOT in accessible list
            const accessibleIds = rawAccessibleIds.filter((id) => id !== targetSchoolId);
            if (accessibleIds.length === 0) return;

            // Use SUPER_ADMIN role to test with a different compute path
            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
            };

            // Mock: SUPER_ADMIN gets these specific schools (NOT including target)
            const activeSchools = accessibleIds.map((id, i) => ({
              id,
              code: `SA${i}`,
              name: `Admin School ${i}`,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            }));

            schoolEntityRepository.find.mockResolvedValue(activeSchools);

            // Target school exists in DB and is ACTIVE — but user can't access it
            schoolRepository.findById.mockImplementation((id: string) => {
              if (id === targetSchoolId) {
                return Promise.resolve({
                  id: targetSchoolId,
                  code: 'NOTACCESSIBLE',
                  name: 'Not Accessible School',
                  status: SchoolStatus.ACTIVE,
                  parentSchoolId: null,
                  deletedAt: null,
                } as unknown as SchoolEntity);
              }
              return Promise.resolve(null);
            });

            // Switch must fail with 403
            let thrownError: any = null;
            try {
              await service.switchContext(user, targetSchoolId, ip);
            } catch (error) {
              thrownError = error;
            }

            // Must throw — context switch must NOT succeed
            expect(thrownError).not.toBeNull();
            expect(thrownError.getStatus()).toBe(403);

            // contextSessionService.setActiveContext must NOT have been called
            expect(contextSessionService.setActiveContext).not.toHaveBeenCalledWith(
              userId,
              targetSchoolId,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Helper: Set up mocks for computeAccessibleSchoolIds based on role ──────

  function setupAccessibleSchoolMocks(
    role: string,
    user: ContextJwtUser,
    accessibleIds: string[],
  ): void {
    if (role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN: schoolEntityRepository.find returns active schools
      const schools = accessibleIds.map((id, i) => ({
        id,
        code: `S${i}`,
        name: `School ${i}`,
        status: SchoolStatus.ACTIVE,
        parentSchoolId: null,
        deletedAt: null,
      }));
      schoolEntityRepository.find.mockResolvedValue(schools);
    } else if (role === UserRole.COMPANY_ADMIN) {
      // COMPANY_ADMIN: findById for company node + find for children
      const companySchoolId = user.companySchoolId;
      if (companySchoolId && accessibleIds.includes(companySchoolId)) {
        // Don't override schoolRepository.findById here — let the main mock handle it
        const children = accessibleIds
          .filter((id) => id !== companySchoolId)
          .map((id, i) => ({
            id,
            code: `CH${i}`,
            name: `Child ${i}`,
            status: SchoolStatus.ACTIVE,
            parentSchoolId: companySchoolId,
            deletedAt: null,
          }));
        schoolEntityRepository.find.mockResolvedValue(children);
      } else if (companySchoolId) {
        schoolEntityRepository.find.mockResolvedValue([]);
      }
    } else if (role === UserRole.TEACHER) {
      // TEACHER: filterActiveSchoolIds via createQueryBuilder
      const mockSchools = accessibleIds.map((id, i) => ({
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
    }
    // For single-school roles (SCHOOL_ADMIN, HR, SCHEDULER, VIEWER),
    // schoolRepository.findById is handled by the main mock in the test
  }
});
