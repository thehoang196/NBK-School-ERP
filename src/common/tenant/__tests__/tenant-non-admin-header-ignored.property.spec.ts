import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';

// Mock uuid module (ESM-only package) before importing middleware
jest.mock('uuid', () => ({
  validate: (str: string) => {
    // Simple UUID v4 validation regex for testing purposes
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  },
}));

import { TenantContextService } from '../tenant-context.service';
import { TenantAuditService } from '../tenant-audit.service';
import { TenantMiddleware } from '../tenant.middleware';
import { TenantStore } from '../tenant.interfaces';
import { UserRole } from '../../enums/role.enum';

/**
 * Feature: multi-tenant-enforcement, Property 9: Non-admin X-School-Id header is ignored
 *
 * **Validates: Requirements 5.3**
 *
 * For any request from a non-SUPER_ADMIN user, regardless of whether an `X-School-Id`
 * header is present and regardless of its value, the TenantMiddleware SHALL set the
 * TenantScopeContext's schoolId to the value from `req.user.schoolId` (JWT claims).
 */
describe('Feature: multi-tenant-enforcement, Property 9: Non-admin X-School-Id header is ignored', () => {
  let tenantContext: TenantContextService;
  let middleware: TenantMiddleware;

  /**
   * Non-SUPER_ADMIN roles that should always have their X-School-Id header ignored.
   */
  const nonSuperAdminRoles = [
    UserRole.SCHOOL_ADMIN,
    UserRole.HR,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
    UserRole.VIEWER,
  ];

  /**
   * Arbitrary for generating a random non-SUPER_ADMIN role.
   */
  const nonSuperAdminRoleArb = fc.constantFrom(...nonSuperAdminRoles);

  /**
   * Creates a mock Express request with user (JWT) and optional X-School-Id header.
   */
  function createMockRequest(
    user: { id: string; role: UserRole; schoolId: string },
    headerSchoolId?: string,
  ): Request {
    const headers: Record<string, string> = {};
    if (headerSchoolId !== undefined) {
      headers['x-school-id'] = headerSchoolId;
    }

    return {
      user,
      headers,
    } as unknown as Request;
  }

  /**
   * Creates a mock Express response object.
   */
  function createMockResponse(): Response {
    return {} as unknown as Response;
  }

  beforeEach(() => {
    tenantContext = new TenantContextService();

    // Mock TenantAuditService
    const mockTenantAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    // Mock TenantRlsService — non-admin path still calls setSessionSchoolId
    const mockTenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
      clearSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    };

    // Mock school repository — non-admin path doesn't call it, but it's required for constructor
    const mockSchoolRepository = {
      findOne: jest.fn().mockResolvedValue(undefined),
    };

    middleware = new TenantMiddleware(
      tenantContext,
      mockTenantAudit,
      mockTenantRlsService as any,
      mockSchoolRepository as any,
    );
  });

  it('middleware uses JWT schoolId regardless of X-School-Id header value, for any non-SUPER_ADMIN role', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonSuperAdminRoleArb,
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (role, userId, jwtSchoolId, headerSchoolId) => {
          const req = createMockRequest(
            { id: userId, role, schoolId: jwtSchoolId },
            headerSchoolId,
          );
          const res = createMockResponse();

          let capturedStore: TenantStore | undefined;

          const next: NextFunction = () => {
            capturedStore = tenantContext.getStore();
          };

          await middleware.use(req, res, next);

          // The tenant context schoolId MUST be the JWT schoolId, NOT the header value
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(jwtSchoolId);
          expect(capturedStore!.schoolId).not.toBe(headerSchoolId);
          expect(capturedStore!.isBypass).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('middleware uses JWT schoolId when no X-School-Id header is present, for any non-SUPER_ADMIN role', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonSuperAdminRoleArb,
        fc.uuid(),
        fc.uuid(),
        async (role, userId, jwtSchoolId) => {
          const req = createMockRequest(
            { id: userId, role, schoolId: jwtSchoolId },
            // No X-School-Id header
          );
          const res = createMockResponse();

          let capturedStore: TenantStore | undefined;

          const next: NextFunction = () => {
            capturedStore = tenantContext.getStore();
          };

          await middleware.use(req, res, next);

          // The tenant context schoolId MUST equal the JWT schoolId
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(jwtSchoolId);
          expect(capturedStore!.isBypass).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('middleware ignores X-School-Id header even when it contains arbitrary string values', async () => {
    // Generate arbitrary string header values (not just UUIDs) to verify they are always ignored
    const arbitraryHeaderArb = fc.oneof(
      fc.uuid(),
      fc.string({ minLength: 1, maxLength: 100 }),
      fc.constant(''),
      fc.constant('invalid-uuid'),
      fc.constant('null'),
      fc.constant('undefined'),
    );

    await fc.assert(
      fc.asyncProperty(
        nonSuperAdminRoleArb,
        fc.uuid(),
        fc.uuid(),
        arbitraryHeaderArb,
        async (role, userId, jwtSchoolId, headerValue) => {
          const req = createMockRequest(
            { id: userId, role, schoolId: jwtSchoolId },
            headerValue,
          );
          const res = createMockResponse();

          let capturedStore: TenantStore | undefined;

          const next: NextFunction = () => {
            capturedStore = tenantContext.getStore();
          };

          await middleware.use(req, res, next);

          // Regardless of what the header contains, JWT schoolId is always used
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(jwtSchoolId);
          expect(capturedStore!.isBypass).toBe(false);
          expect(capturedStore!.userId).toBe(userId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('request.schoolScope is set to JWT schoolId even when X-School-Id header differs', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonSuperAdminRoleArb,
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (role, userId, jwtSchoolId, headerSchoolId) => {
          const req = createMockRequest(
            { id: userId, role, schoolId: jwtSchoolId },
            headerSchoolId,
          );
          const res = createMockResponse();

          const next: NextFunction = () => {
            // no-op
          };

          await middleware.use(req, res, next);

          // Backward compat: req.schoolScope should match JWT schoolId
          expect((req as any).schoolScope).toBe(jwtSchoolId);
        },
      ),
      { numRuns: 100 },
    );
  });
});
