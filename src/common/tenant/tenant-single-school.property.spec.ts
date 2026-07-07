import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';

// Mock uuid module (ESM-only package) before importing middleware
jest.mock('uuid', () => ({
  validate: (str: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  },
}));

import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantStore } from './tenant.interfaces';
import { UserRole } from '../enums/role.enum';

/**
 * Feature: workspace-context-switcher, Property 15: Single-school users ignore X-School-Id header
 *
 * **Validates: Requirements 9.10**
 *
 * For any user with single-school access (SCHOOL_ADMIN, HR, SCHEDULER, VIEWER,
 * or TEACHER with one school), the TenantMiddleware SHALL resolve context from
 * the JWT schoolId directly, ignoring any X-School-Id header value.
 */
describe('Feature: workspace-context-switcher, Property 15: Single-school users ignore X-School-Id header', () => {
  let tenantContext: TenantContextService;
  let middleware: TenantMiddleware;
  let mockContextSessionService: { getActiveContext: jest.Mock; refreshTtl: jest.Mock; deleteSession: jest.Mock };
  let mockContextService: { computeAccessibleSchoolIds: jest.Mock };

  /**
   * Single-school roles that always resolve from JWT (never multi-school).
   */
  const singleSchoolRoles = [
    UserRole.SCHOOL_ADMIN,
    UserRole.HR,
    UserRole.SCHEDULER,
    UserRole.VIEWER,
  ];

  /**
   * Arbitrary for generating a random single-school role (excluding TEACHER).
   */
  const singleSchoolRoleArb = fc.constantFrom(...singleSchoolRoles);

  /**
   * Creates a mock Express request with user (JWT) and optional X-School-Id header.
   */
  function createMockRequest(
    user: {
      id: string;
      role: UserRole;
      schoolId: string;
      accessibleSchoolIds?: string[];
    },
    headerSchoolId?: string,
  ): Request {
    const headers: Record<string, string> = {};
    if (headerSchoolId !== undefined) {
      headers['x-school-id'] = headerSchoolId;
    }

    return {
      user,
      headers,
      method: 'GET',
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

    const mockTenantAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    const mockTenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
      clearSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    };

    const mockSchoolRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'some-id' }),
    };

    mockContextSessionService = {
      getActiveContext: jest.fn().mockResolvedValue(null),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
      deleteSession: jest.fn().mockResolvedValue(undefined),
    };

    mockContextService = {
      computeAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    middleware = new TenantMiddleware(
      tenantContext,
      mockTenantAudit,
      mockTenantRlsService as any,
      mockSchoolRepository as any,
      mockContextSessionService as any,
      mockContextService as any,
    );
  });

  it('single-school roles (SCHOOL_ADMIN, HR, SCHEDULER, VIEWER) always resolve from JWT schoolId, ignoring any X-School-Id header', async () => {
    await fc.assert(
      fc.asyncProperty(
        singleSchoolRoleArb,
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (role, userId, jwtSchoolId, headerSchoolId) => {
          // Ensure header differs from JWT to verify it's being ignored
          fc.pre(jwtSchoolId !== headerSchoolId);

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

          // Single-school users MUST resolve from JWT, ignoring X-School-Id header
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(jwtSchoolId);
          expect(capturedStore!.isBypass).toBe(false);
          expect(capturedStore!.userId).toBe(userId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('TEACHER with accessibleSchoolIds.length === 0 resolves from JWT schoolId, ignoring X-School-Id header', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (userId, jwtSchoolId, headerSchoolId) => {
          fc.pre(jwtSchoolId !== headerSchoolId);

          const req = createMockRequest(
            {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: [], // Empty = single-school
            },
            headerSchoolId,
          );
          const res = createMockResponse();

          let capturedStore: TenantStore | undefined;

          const next: NextFunction = () => {
            capturedStore = tenantContext.getStore();
          };

          await middleware.use(req, res, next);

          // Teacher with 0 accessible schools is single-school → JWT schoolId used
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(jwtSchoolId);
          expect(capturedStore!.isBypass).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('TEACHER with accessibleSchoolIds.length === 1 resolves from JWT schoolId, ignoring X-School-Id header', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (userId, jwtSchoolId, headerSchoolId) => {
          fc.pre(jwtSchoolId !== headerSchoolId);

          const req = createMockRequest(
            {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: [jwtSchoolId], // Exactly 1 = single-school
            },
            headerSchoolId,
          );
          const res = createMockResponse();

          let capturedStore: TenantStore | undefined;

          const next: NextFunction = () => {
            capturedStore = tenantContext.getStore();
          };

          await middleware.use(req, res, next);

          // Teacher with exactly 1 school is single-school → JWT schoolId used
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(jwtSchoolId);
          expect(capturedStore!.isBypass).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('TEACHER with no accessibleSchoolIds property (undefined) resolves from JWT schoolId, ignoring X-School-Id header', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (userId, jwtSchoolId, headerSchoolId) => {
          fc.pre(jwtSchoolId !== headerSchoolId);

          const req = createMockRequest(
            {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: jwtSchoolId,
              // accessibleSchoolIds is undefined → treated as single-school
            },
            headerSchoolId,
          );
          const res = createMockResponse();

          let capturedStore: TenantStore | undefined;

          const next: NextFunction = () => {
            capturedStore = tenantContext.getStore();
          };

          await middleware.use(req, res, next);

          // Teacher without accessibleSchoolIds is treated as single-school
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(jwtSchoolId);
          expect(capturedStore!.isBypass).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('single-school users ignore X-School-Id header even with arbitrary non-UUID header values', async () => {
    // Note: "global" is excluded because it's a protocol-level keyword that triggers
    // Global View handling (HTTP 403 for non-SUPER_ADMIN per Requirement 5.4),
    // which is tested separately in Property 13.
    const arbitraryHeaderArb = fc.oneof(
      fc.uuid(),
      fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s !== 'global'),
      fc.constant('invalid-uuid'),
      fc.constant('null'),
      fc.constant(''),
    );

    // All single-school roles + TEACHER with 1 school
    const allSingleSchoolUserArb = fc.oneof(
      // Standard single-school roles
      fc.record({
        id: fc.uuid(),
        role: singleSchoolRoleArb,
        schoolId: fc.uuid(),
        accessibleSchoolIds: fc.constant(undefined as unknown as string[]),
      }),
      // TEACHER with exactly 1 accessible school
      fc.uuid().chain((schoolId) =>
        fc.record({
          id: fc.uuid(),
          role: fc.constant(UserRole.TEACHER),
          schoolId: fc.constant(schoolId),
          accessibleSchoolIds: fc.constant([schoolId]),
        }),
      ),
      // TEACHER with empty accessible schools
      fc.record({
        id: fc.uuid(),
        role: fc.constant(UserRole.TEACHER),
        schoolId: fc.uuid(),
        accessibleSchoolIds: fc.constant([] as string[]),
      }),
    );

    await fc.assert(
      fc.asyncProperty(
        allSingleSchoolUserArb,
        arbitraryHeaderArb,
        async (user, headerValue) => {
          const req = createMockRequest(
            user as any,
            headerValue,
          );
          const res = createMockResponse();

          let capturedStore: TenantStore | undefined;

          const next: NextFunction = () => {
            capturedStore = tenantContext.getStore();
          };

          await middleware.use(req, res, next);

          // Regardless of header value, single-school user resolves from JWT
          expect(capturedStore).toBeDefined();
          expect(capturedStore!.schoolId).toBe(user.schoolId);
          expect(capturedStore!.isBypass).toBe(false);
          expect(capturedStore!.userId).toBe(user.id);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Redis context session is never consulted for single-school users', async () => {
    await fc.assert(
      fc.asyncProperty(
        singleSchoolRoleArb,
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (role, userId, jwtSchoolId, headerSchoolId) => {
          // Reset mock call counts before each iteration
          mockContextSessionService.getActiveContext.mockClear();

          const req = createMockRequest(
            { id: userId, role, schoolId: jwtSchoolId },
            headerSchoolId,
          );
          const res = createMockResponse();

          const next: NextFunction = () => {
            // no-op
          };

          await middleware.use(req, res, next);

          // Single-school users should never consult Redis session
          expect(mockContextSessionService.getActiveContext).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
