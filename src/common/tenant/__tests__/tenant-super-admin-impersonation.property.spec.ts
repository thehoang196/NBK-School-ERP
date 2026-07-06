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
 * Feature: multi-tenant-enforcement, Property 8: Super Admin impersonation sets target context
 *
 * **Validates: Requirements 5.2**
 *
 * For any request from a SUPER_ADMIN user with a valid X-School-Id header containing
 * an existing school's UUID, the TenantMiddleware SHALL set the TenantScopeContext's
 * schoolId to the header value (not bypass mode).
 */
describe('Feature: multi-tenant-enforcement, Property 8: Super Admin impersonation sets target context', () => {
  let tenantContext: TenantContextService;
  let middleware: TenantMiddleware;
  let mockSchoolRepository: { findOne: jest.Mock };
  let mockTenantRlsService: { setSessionSchoolId: jest.Mock; clearSessionSchoolId: jest.Mock };
  let mockTenantAudit: { logTenantContextError: jest.Mock; logRlsViolation: jest.Mock; logImpersonation: jest.Mock };

  /**
   * Creates a mock Request object with SUPER_ADMIN user and X-School-Id header.
   */
  function createSuperAdminRequest(headerSchoolId: string): Partial<Request> {
    return {
      user: {
        id: 'super-admin-user-id',
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      },
      headers: {
        'x-school-id': headerSchoolId,
      },
    } as unknown as Partial<Request>;
  }

  /**
   * Creates a mock Response object.
   */
  function createMockResponse(): Partial<Response> {
    return {} as Partial<Response>;
  }

  beforeEach(() => {
    tenantContext = new TenantContextService();

    // Mock schoolRepository — findOne returns a school entity for any valid UUID
    mockSchoolRepository = {
      findOne: jest.fn(),
    };

    // Mock TenantRlsService
    mockTenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
      clearSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    };

    // Mock TenantAuditService
    mockTenantAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    };

    // Create middleware with real TenantContextService and mocked dependencies
    middleware = new TenantMiddleware(
      tenantContext,
      mockTenantAudit as unknown as TenantAuditService,
      mockTenantRlsService as any,
      mockSchoolRepository as any,
    );
  });

  it('sets schoolId to X-School-Id header value for SUPER_ADMIN with valid school UUID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (headerSchoolId) => {
        // Mock findOne to simulate that the school exists
        mockSchoolRepository.findOne.mockResolvedValue({ id: headerSchoolId });

        const req = createSuperAdminRequest(headerSchoolId);
        const res = createMockResponse();

        let capturedSchoolId: string | null | undefined;
        let capturedIsBypass: boolean | undefined;

        const next: NextFunction = () => {
          // Capture the tenant context inside the run() scope
          capturedSchoolId = tenantContext.getSchoolId();
          capturedIsBypass = tenantContext.isBypass();
        };

        await middleware.use(req as Request, res as Response, next);

        // Verify that the context schoolId matches the header value
        expect(capturedSchoolId).toBe(headerSchoolId);
        // Verify that it is NOT bypass mode (impersonation ≠ bypass)
        expect(capturedIsBypass).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('sets request.schoolScope to the X-School-Id header value for backward compatibility', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (headerSchoolId) => {
        // Mock findOne to simulate that the school exists
        mockSchoolRepository.findOne.mockResolvedValue({ id: headerSchoolId });

        const req = createSuperAdminRequest(headerSchoolId);
        const res = createMockResponse();

        const next: NextFunction = () => {};

        await middleware.use(req as Request, res as Response, next);

        // Verify backward compatibility — req.schoolScope should match header value
        expect((req as any).schoolScope).toBe(headerSchoolId);
      }),
      { numRuns: 100 },
    );
  });

  it('validates the school exists by calling schoolRepository.findOne with the header UUID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (headerSchoolId) => {
        mockSchoolRepository.findOne.mockResolvedValue({ id: headerSchoolId });

        const req = createSuperAdminRequest(headerSchoolId);
        const res = createMockResponse();
        const next: NextFunction = () => {};

        await middleware.use(req as Request, res as Response, next);

        // Verify the repository was called with the correct school ID
        expect(mockSchoolRepository.findOne).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: headerSchoolId },
          }),
        );
      }),
      { numRuns: 100 },
    );
  });
});
