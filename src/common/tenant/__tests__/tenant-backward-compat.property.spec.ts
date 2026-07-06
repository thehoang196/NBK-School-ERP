import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';

// Mock uuid module to avoid ESM import issues in Jest
jest.mock('uuid', () => ({
  validate: (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },
}));

import { TenantContextService } from '../tenant-context.service';
import { TenantAuditService } from '../tenant-audit.service';
import { TenantMiddleware } from '../tenant.middleware';
import { UserRole } from '../../enums/role.enum';

/**
 * Feature: multi-tenant-enforcement, Property 10: Backward compatibility — request.schoolScope
 *
 * **Validates: Requirements 6.2, 6.4**
 *
 * For any request processed by the TenantMiddleware, `request.schoolScope` SHALL be set
 * to the same value as the TenantScopeContext's schoolId (or null when in bypass mode),
 * maintaining compatibility with existing code using the `@SchoolScope()` decorator.
 */
describe('Feature: multi-tenant-enforcement, Property 10: Backward compatibility — request.schoolScope', () => {
  let tenantContextService: TenantContextService;
  let middleware: TenantMiddleware;
  let mockSchoolRepository: { findOne: jest.Mock };
  let mockTenantRlsService: { setSessionSchoolId: jest.Mock; clearSessionSchoolId: jest.Mock };

  beforeEach(() => {
    tenantContextService = new TenantContextService();
    mockSchoolRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'some-id' }),
    };
    mockTenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
      clearSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    };

    const mockTenantAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    middleware = new TenantMiddleware(
      tenantContextService,
      mockTenantAudit,
      mockTenantRlsService as any,
      mockSchoolRepository as any,
    );
  });

  /**
   * For non-SUPER_ADMIN users, request.schoolScope should match user.schoolId
   */
  it('request.schoolScope matches user.schoolId for any non-SUPER_ADMIN user', async () => {
    const nonSuperAdminRoles = [
      UserRole.SCHOOL_ADMIN,
      UserRole.HR,
      UserRole.SCHEDULER,
      UserRole.TEACHER,
      UserRole.VIEWER,
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(...nonSuperAdminRoles),
        fc.uuid(),
        async (schoolId, role, userId) => {
          const req = {
            user: {
              id: userId,
              schoolId,
              role,
            },
            headers: {},
          } as unknown as Request;

          const res = {} as Response;
          let nextCalled = false;
          const next: NextFunction = () => {
            nextCalled = true;
          };

          await middleware.use(req, res, next);

          expect(nextCalled).toBe(true);
          expect((req as any).schoolScope).toBe(schoolId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * For SUPER_ADMIN without X-School-Id header (bypass mode),
   * request.schoolScope should be null
   */
  it('request.schoolScope is null for SUPER_ADMIN without X-School-Id header (bypass mode)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const req = {
          user: {
            id: userId,
            schoolId: null,
            role: UserRole.SUPER_ADMIN,
          },
          headers: {},
        } as unknown as Request;

        const res = {} as Response;
        let nextCalled = false;
        const next: NextFunction = () => {
          nextCalled = true;
        };

        await middleware.use(req, res, next);

        expect(nextCalled).toBe(true);
        expect((req as any).schoolScope).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * For SUPER_ADMIN with valid X-School-Id header (impersonation mode),
   * request.schoolScope should match the header value
   */
  it('request.schoolScope matches X-School-Id header for SUPER_ADMIN impersonation', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (userId, targetSchoolId) => {
        mockSchoolRepository.findOne.mockResolvedValue({ id: targetSchoolId });

        const req = {
          user: {
            id: userId,
            schoolId: null,
            role: UserRole.SUPER_ADMIN,
          },
          headers: {
            'x-school-id': targetSchoolId,
          },
        } as unknown as Request;

        const res = {} as Response;
        let nextCalled = false;
        const next: NextFunction = () => {
          nextCalled = true;
        };

        await middleware.use(req, res, next);

        expect(nextCalled).toBe(true);
        expect((req as any).schoolScope).toBe(targetSchoolId);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * For non-SUPER_ADMIN users with an X-School-Id header present,
   * request.schoolScope should still match user.schoolId (header ignored)
   */
  it('request.schoolScope uses user.schoolId even when X-School-Id header is present for non-SUPER_ADMIN', async () => {
    const nonSuperAdminRoles = [
      UserRole.SCHOOL_ADMIN,
      UserRole.HR,
      UserRole.SCHEDULER,
      UserRole.TEACHER,
      UserRole.VIEWER,
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom(...nonSuperAdminRoles),
        fc.uuid(),
        async (userSchoolId, headerSchoolId, role, userId) => {
          const req = {
            user: {
              id: userId,
              schoolId: userSchoolId,
              role,
            },
            headers: {
              'x-school-id': headerSchoolId,
            },
          } as unknown as Request;

          const res = {} as Response;
          let nextCalled = false;
          const next: NextFunction = () => {
            nextCalled = true;
          };

          await middleware.use(req, res, next);

          expect(nextCalled).toBe(true);
          expect((req as any).schoolScope).toBe(userSchoolId);
        },
      ),
      { numRuns: 100 },
    );
  });
});
