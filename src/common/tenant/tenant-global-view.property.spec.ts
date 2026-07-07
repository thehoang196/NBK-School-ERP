/**
 * Feature: workspace-context-switcher, Properties 13, 14: Global View Access Control
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 *
 * Tests:
 * - Property 13: Global View activation requires SUPER_ADMIN — Only SUPER_ADMIN can activate globalView
 * - Property 14: Global View restricts to GET only — Non-GET methods rejected with 403 in Global View
 */
import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';

import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantRlsService } from './tenant-rls.service';
import { UserRole } from '../enums/role.enum';
import { ContextSessionService } from '../../modules/context/services/context-session.service';
import { ContextService } from '../../modules/context/services/context.service';
import {
  GlobalViewForbiddenException,
  GlobalViewReadonlyException,
} from '../../modules/context/exceptions/context.exceptions';

jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      str,
    ),
}));

// Import TenantMiddleware AFTER mocking uuid
import { TenantMiddleware } from './tenant.middleware';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();

/**
 * All UserRole values that are NOT SUPER_ADMIN.
 * These should all be rejected when trying to activate Global View.
 */
const nonSuperAdminRoleArb = fc.constantFrom(
  UserRole.HOLDING_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.HR,
  UserRole.SCHEDULER,
  UserRole.TEACHER,
  UserRole.VIEWER,
);

/**
 * All UserRole values (used for Property 14 which applies regardless of role,
 * but Global View is only active for SUPER_ADMIN).
 */
const allRolesArb = fc.constantFrom(
  ...Object.values(UserRole),
) as fc.Arbitrary<UserRole>;

/**
 * HTTP methods that are NOT GET — these should be rejected in Global View mode.
 */
const nonGetMethodArb = fc.constantFrom('POST', 'PUT', 'PATCH', 'DELETE');

/**
 * All HTTP methods including GET.
 */
const httpMethodArb = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Feature: workspace-context-switcher, Global View Access Control', () => {
  let middleware: TenantMiddleware;
  let mockTenantContext: { run: jest.Mock };
  let mockTenantAudit: { logImpersonation: jest.Mock };
  let mockTenantRlsService: { setSessionSchoolId: jest.Mock };
  let mockSchoolRepository: { findOne: jest.Mock };
  let mockContextSessionService: {
    getActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
  };
  let mockContextService: { computeAccessibleSchoolIds: jest.Mock };

  beforeEach(() => {
    mockTenantContext = {
      run: jest.fn((store, callback) => callback()),
    };

    mockTenantAudit = {
      logImpersonation: jest.fn(),
    };

    mockTenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    };

    mockSchoolRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockContextSessionService = {
      getActiveContext: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
    };

    mockContextService = {
      computeAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    middleware = new TenantMiddleware(
      mockTenantContext as unknown as TenantContextService,
      mockTenantAudit as unknown as TenantAuditService,
      mockTenantRlsService as unknown as TenantRlsService,
      mockSchoolRepository as any,
      mockContextSessionService as unknown as ContextSessionService,
      mockContextService as unknown as ContextService,
    );
  });

  /**
   * Helper to create a mock Express Request.
   */
  function createMockRequest(options: {
    user: Record<string, unknown>;
    headers?: Record<string, string>;
    method?: string;
  }): any {
    return {
      user: options.user,
      headers: options.headers || {},
      method: options.method || 'GET',
    };
  }

  /**
   * Helper to create a mock Express Response.
   */
  function createMockResponse(): any {
    return {};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Property 13: Global View activation requires SUPER_ADMIN
  // ─────────────────────────────────────────────────────────────────────────

  describe('Property 13: Global View activation requires SUPER_ADMIN', () => {
    /**
     * **Validates: Requirements 5.1, 5.4, 5.5**
     *
     * For any request with header X-School-Id = "global", if role is SUPER_ADMIN
     * then TenantStore.globalView SHALL be true and isBypass SHALL be true;
     * if role is anything other than SUPER_ADMIN then request SHALL be rejected with 403.
     */

    it('SUPER_ADMIN with X-School-Id="global" SHALL activate globalView=true and isBypass=true', async () => {
      await fc.assert(
        fc.asyncProperty(uuidArb, async (userId) => {
          const user = {
            id: userId,
            role: UserRole.SUPER_ADMIN,
            schoolId: null,
            accessibleSchoolIds: [],
          };

          const req = createMockRequest({
            user,
            headers: { 'x-school-id': 'global' },
            method: 'GET',
          });

          const res = createMockResponse();
          const next = jest.fn();

          await middleware.use(req, res, next);

          // next() should have been called (no exception thrown)
          expect(next).toHaveBeenCalled();

          // TenantContext.run should be called with globalView=true and isBypass=true
          expect(mockTenantContext.run).toHaveBeenCalledWith(
            expect.objectContaining({
              globalView: true,
              isBypass: true,
              schoolId: null,
              userId,
            }),
            expect.any(Function),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('non-SUPER_ADMIN with X-School-Id="global" SHALL be rejected with 403 (GlobalViewForbiddenException)', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonSuperAdminRoleArb,
          uuidArb,
          uuidArb, // schoolId in JWT
          async (role, userId, schoolId) => {
            const user = {
              id: userId,
              role,
              schoolId,
              accessibleSchoolIds: [schoolId],
            };

            const req = createMockRequest({
              user,
              headers: { 'x-school-id': 'global' },
              method: 'GET',
            });

            const res = createMockResponse();
            const next = jest.fn();

            await expect(middleware.use(req, res, next)).rejects.toThrow(
              GlobalViewForbiddenException,
            );

            // next() should NOT have been called
            expect(next).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('non-SUPER_ADMIN rejection SHALL be HTTP 403 with correct error code', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonSuperAdminRoleArb,
          uuidArb,
          uuidArb,
          async (role, userId, schoolId) => {
            const user = {
              id: userId,
              role,
              schoolId,
              accessibleSchoolIds: [schoolId],
            };

            const req = createMockRequest({
              user,
              headers: { 'x-school-id': 'global' },
              method: 'GET',
            });

            const res = createMockResponse();
            const next = jest.fn();

            try {
              await middleware.use(req, res, next);
              // Should not reach here
              fail('Expected GlobalViewForbiddenException to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(ForbiddenException);
              expect(error).toBeInstanceOf(GlobalViewForbiddenException);
              const response = (error as ForbiddenException).getResponse() as any;
              expect(response.errorCode).toBe('GLOBAL_VIEW_FORBIDDEN');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Property 14: Global View restricts to GET only
  // ─────────────────────────────────────────────────────────────────────────

  describe('Property 14: Global View restricts to GET only', () => {
    /**
     * **Validates: Requirements 5.2, 5.3**
     *
     * For any request where Global View mode is active, if HTTP method is not GET
     * then request SHALL be rejected with 403 (GlobalViewReadonlyException).
     */

    it('non-GET methods SHALL be rejected with 403 when Global View is active', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonGetMethodArb,
          uuidArb, // userId
          async (method, userId) => {
            const user = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
              accessibleSchoolIds: [],
            };

            const req = createMockRequest({
              user,
              headers: { 'x-school-id': 'global' },
              method,
            });

            const res = createMockResponse();
            const next = jest.fn();

            await expect(middleware.use(req, res, next)).rejects.toThrow(
              GlobalViewReadonlyException,
            );

            // next() should NOT have been called
            expect(next).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('non-GET rejection SHALL include correct error code GLOBAL_VIEW_READONLY', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonGetMethodArb,
          uuidArb,
          async (method, userId) => {
            const user = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
              accessibleSchoolIds: [],
            };

            const req = createMockRequest({
              user,
              headers: { 'x-school-id': 'global' },
              method,
            });

            const res = createMockResponse();
            const next = jest.fn();

            try {
              await middleware.use(req, res, next);
              fail('Expected GlobalViewReadonlyException to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(ForbiddenException);
              expect(error).toBeInstanceOf(GlobalViewReadonlyException);
              const response = (error as ForbiddenException).getResponse() as any;
              expect(response.errorCode).toBe('GLOBAL_VIEW_READONLY');
              expect(response.message).toBe(
                'Không thể thực hiện thao tác ghi trong chế độ Global View',
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('GET method SHALL be allowed when Global View is active', async () => {
      await fc.assert(
        fc.asyncProperty(uuidArb, async (userId) => {
          const user = {
            id: userId,
            role: UserRole.SUPER_ADMIN,
            schoolId: null,
            accessibleSchoolIds: [],
          };

          const req = createMockRequest({
            user,
            headers: { 'x-school-id': 'global' },
            method: 'GET',
          });

          const res = createMockResponse();
          const next = jest.fn();

          await middleware.use(req, res, next);

          // next() SHOULD have been called (request allowed)
          expect(next).toHaveBeenCalled();

          // Verify globalView is active in tenant context
          expect(mockTenantContext.run).toHaveBeenCalledWith(
            expect.objectContaining({
              globalView: true,
              isBypass: true,
            }),
            expect.any(Function),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('combined: any HTTP method + Global View active → only GET passes, rest get 403', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpMethodArb,
          uuidArb,
          async (method, userId) => {
            const user = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
              accessibleSchoolIds: [],
            };

            const req = createMockRequest({
              user,
              headers: { 'x-school-id': 'global' },
              method,
            });

            const res = createMockResponse();
            const next = jest.fn();

            if (method === 'GET') {
              // GET should succeed
              await middleware.use(req, res, next);
              expect(next).toHaveBeenCalled();
            } else {
              // Non-GET should throw GlobalViewReadonlyException
              await expect(middleware.use(req, res, next)).rejects.toThrow(
                GlobalViewReadonlyException,
              );
              expect(next).not.toHaveBeenCalled();
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
