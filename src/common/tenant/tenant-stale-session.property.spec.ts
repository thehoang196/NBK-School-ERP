import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';

// Mock uuid module to avoid ESM import issues in Jest
jest.mock('uuid', () => ({
  validate: (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },
}));

import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantMiddleware } from './tenant.middleware';
import { UserRole } from '../enums/role.enum';

/**
 * Feature: workspace-context-switcher, Property 11: Stale session invalidation
 *
 * **Validates: Requirements 3.8, 8.6**
 *
 * For any Redis context session containing a schoolId that is no longer in the user's
 * computed accessible schools list, the TenantMiddleware SHALL delete the stale session
 * and fall back to the JWT schoolId.
 */
describe('Feature: workspace-context-switcher, Property 11: Stale session invalidation', () => {
  let tenantContextService: TenantContextService;
  let middleware: TenantMiddleware;
  let mockSchoolRepository: { findOne: jest.Mock };
  let mockTenantRlsService: { setSessionSchoolId: jest.Mock; clearSessionSchoolId: jest.Mock };
  let mockTenantAudit: TenantAuditService;
  let mockContextSessionService: {
    getActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
    setActiveContext: jest.Mock;
  };
  let mockContextService: {
    computeAccessibleSchoolIds: jest.Mock;
  };

  beforeEach(() => {
    tenantContextService = new TenantContextService();
    mockSchoolRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'some-id' }),
    };
    mockTenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
      clearSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    };
    mockTenantAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    mockContextSessionService = {
      getActiveContext: jest.fn(),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
      setActiveContext: jest.fn().mockResolvedValue(undefined),
    };

    mockContextService = {
      computeAccessibleSchoolIds: jest.fn(),
    };

    middleware = new TenantMiddleware(
      tenantContextService,
      mockTenantAudit,
      mockTenantRlsService as any,
      mockSchoolRepository as any,
      mockContextSessionService as any,
      mockContextService as any,
    );
  });

  /**
   * Property 11a: When a session contains a schoolId NOT in the user's accessible list,
   * deleteSession MUST be called and context falls back to JWT schoolId.
   *
   * For multi-school users (SUPER_ADMIN, COMPANY_ADMIN, TEACHER with multiple schools),
   * if the session schoolId is not in the computed accessible list, the middleware deletes
   * the session and falls back to JWT.
   */
  it('should delete stale session and fall back to JWT schoolId when session schoolId is not in accessible list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // stale session schoolId (NOT in accessible list)
        fc.uuid(), // JWT schoolId (fallback)
        fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 5 }), // accessible schools (does NOT include stale session schoolId)
        async (userId, staleSessionSchoolId, jwtSchoolId, accessibleSchools) => {
          // Ensure the stale session schoolId is NOT in the accessible schools list
          const filteredAccessible = accessibleSchools.filter(
            (id) => id !== staleSessionSchoolId,
          );
          // Need at least 1 accessible school for multi-school scenario (use JWT schoolId as one)
          const accessibleList = [jwtSchoolId, ...filteredAccessible.slice(0, 3)].filter(
            (id) => id !== staleSessionSchoolId,
          );

          // Ensure we have a multi-school user (at least 2 accessible schools)
          if (accessibleList.length < 2) {
            accessibleList.push(fc.sample(fc.uuid(), 1)[0]);
          }

          // Setup: session returns stale schoolId
          mockContextSessionService.getActiveContext.mockResolvedValue(staleSessionSchoolId);
          mockContextSessionService.deleteSession.mockClear();
          mockContextSessionService.refreshTtl.mockClear();

          // Setup: computeAccessibleSchoolIds returns list WITHOUT stale session schoolId
          mockContextService.computeAccessibleSchoolIds.mockResolvedValue(accessibleList);

          // Use COMPANY_ADMIN as a multi-school role that uses session resolution
          const req = {
            user: {
              id: userId,
              schoolId: jwtSchoolId,
              role: UserRole.COMPANY_ADMIN,
              companySchoolId: accessibleList[0],
            },
            headers: {},
            method: 'GET',
          } as unknown as Request;

          const res = {} as Response;
          let nextCalled = false;
          const next: NextFunction = () => {
            nextCalled = true;
          };

          await middleware.use(req, res, next);

          // Verify: stale session was deleted
          expect(mockContextSessionService.deleteSession).toHaveBeenCalledWith(userId);

          // Verify: refreshTtl was NOT called (session was stale)
          expect(mockContextSessionService.refreshTtl).not.toHaveBeenCalled();

          // Verify: request completed (fell through to JWT fallback)
          expect(nextCalled).toBe(true);

          // Verify: schoolScope falls back to JWT schoolId (not the stale session)
          expect((req as any).schoolScope).not.toBe(staleSessionSchoolId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 11b: When session schoolId IS in accessible list, session is NOT deleted
   * and TTL is refreshed.
   *
   * This is the inverse property: valid sessions should NOT be deleted.
   */
  it('should NOT delete session and should refresh TTL when session schoolId is in accessible list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 5 }), // accessible schools
        async (userId, accessibleSchools) => {
          // Pick a random accessible school as the session value
          const validSessionSchoolId = accessibleSchools[0];

          // Setup: session returns a valid schoolId
          mockContextSessionService.getActiveContext.mockResolvedValue(validSessionSchoolId);
          mockContextSessionService.deleteSession.mockClear();
          mockContextSessionService.refreshTtl.mockClear();

          // Setup: computeAccessibleSchoolIds includes the session schoolId
          mockContextService.computeAccessibleSchoolIds.mockResolvedValue(accessibleSchools);

          const req = {
            user: {
              id: userId,
              schoolId: accessibleSchools[1] || accessibleSchools[0],
              role: UserRole.COMPANY_ADMIN,
              companySchoolId: accessibleSchools[0],
            },
            headers: {},
            method: 'GET',
          } as unknown as Request;

          const res = {} as Response;
          let nextCalled = false;
          const next: NextFunction = () => {
            nextCalled = true;
          };

          await middleware.use(req, res, next);

          // Verify: session was NOT deleted
          expect(mockContextSessionService.deleteSession).not.toHaveBeenCalled();

          // Verify: TTL was refreshed
          expect(mockContextSessionService.refreshTtl).toHaveBeenCalledWith(userId);

          // Verify: request completed with session schoolId
          expect(nextCalled).toBe(true);
          expect((req as any).schoolScope).toBe(validSessionSchoolId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 11c: Stale session invalidation for TEACHER with multiple schools.
   *
   * Teachers with multiple accessible schools also use session resolution.
   * When their session references a school no longer accessible, it should be deleted.
   */
  it('should delete stale session for TEACHER with multiple schools', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // stale session schoolId
        fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 4 }), // accessible schools (NOT including stale)
        async (userId, staleSessionSchoolId, accessibleSchools) => {
          // Ensure stale schoolId is NOT in the accessible list
          const filteredAccessible = accessibleSchools.filter(
            (id) => id !== staleSessionSchoolId,
          );
          if (filteredAccessible.length < 2) {
            filteredAccessible.push(fc.sample(fc.uuid(), 1)[0]);
          }

          // Setup: session returns stale schoolId
          mockContextSessionService.getActiveContext.mockResolvedValue(staleSessionSchoolId);
          mockContextSessionService.deleteSession.mockClear();
          mockContextSessionService.refreshTtl.mockClear();

          // Setup: computeAccessibleSchoolIds returns list WITHOUT stale session schoolId
          mockContextService.computeAccessibleSchoolIds.mockResolvedValue(filteredAccessible);

          const req = {
            user: {
              id: userId,
              schoolId: filteredAccessible[0],
              role: UserRole.TEACHER,
              accessibleSchoolIds: filteredAccessible,
            },
            headers: {},
            method: 'GET',
          } as unknown as Request;

          const res = {} as Response;
          let nextCalled = false;
          const next: NextFunction = () => {
            nextCalled = true;
          };

          await middleware.use(req, res, next);

          // Verify: stale session was deleted
          expect(mockContextSessionService.deleteSession).toHaveBeenCalledWith(userId);

          // Verify: refreshTtl was NOT called (stale session)
          expect(mockContextSessionService.refreshTtl).not.toHaveBeenCalled();

          // Verify: request completed (falls back to JWT)
          expect(nextCalled).toBe(true);

          // Verify: resolved context is NOT the stale session
          expect((req as any).schoolScope).not.toBe(staleSessionSchoolId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 11d: Stale session invalidation for SUPER_ADMIN.
   *
   * SUPER_ADMIN also uses session resolution. When their session references a
   * school no longer accessible (e.g., school deactivated), it should be deleted.
   */
  it('should delete stale session for SUPER_ADMIN and fall back to bypass mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // stale session schoolId
        fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 5 }), // all active schools (NOT including stale)
        async (userId, staleSessionSchoolId, activeSchools) => {
          // Ensure stale schoolId is NOT in the accessible list
          const filteredActive = activeSchools.filter(
            (id) => id !== staleSessionSchoolId,
          );
          if (filteredActive.length < 1) {
            filteredActive.push(fc.sample(fc.uuid(), 1)[0]);
          }

          // Setup: session returns stale schoolId
          mockContextSessionService.getActiveContext.mockResolvedValue(staleSessionSchoolId);
          mockContextSessionService.deleteSession.mockClear();
          mockContextSessionService.refreshTtl.mockClear();

          // Setup: computeAccessibleSchoolIds returns list WITHOUT stale session schoolId
          mockContextService.computeAccessibleSchoolIds.mockResolvedValue(filteredActive);

          const req = {
            user: {
              id: userId,
              schoolId: null,
              role: UserRole.SUPER_ADMIN,
            },
            headers: {},
            method: 'GET',
          } as unknown as Request;

          const res = {} as Response;
          let nextCalled = false;
          const next: NextFunction = () => {
            nextCalled = true;
          };

          await middleware.use(req, res, next);

          // Verify: stale session was deleted
          expect(mockContextSessionService.deleteSession).toHaveBeenCalledWith(userId);

          // Verify: refreshTtl was NOT called (stale session)
          expect(mockContextSessionService.refreshTtl).not.toHaveBeenCalled();

          // Verify: request completed (SUPER_ADMIN falls back to bypass mode)
          expect(nextCalled).toBe(true);

          // SUPER_ADMIN fallback is bypass mode (schoolScope = null)
          expect((req as any).schoolScope).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
