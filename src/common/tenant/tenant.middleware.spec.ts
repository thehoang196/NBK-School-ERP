import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { TenantMiddleware } from './tenant.middleware';
import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantRlsService } from './tenant-rls.service';
import { UserRole } from '../enums/role.enum';
import { SchoolEntity } from '../../modules/school/entities/school.entity';
import { ContextSessionService } from '../../modules/context/services/context-session.service';
import { ContextService } from '../../modules/context/services/context.service';
import {
  ContextForbiddenException,
  GlobalViewForbiddenException,
  GlobalViewReadonlyException,
} from '../../modules/context/exceptions/context.exceptions';

jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      str,
    ),
}));

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let tenantContextService: TenantContextService;
  let mockTenantAudit: jest.Mocked<
    Pick<TenantAuditService, 'logTenantContextError' | 'logRlsViolation' | 'logImpersonation'>
  >;
  let mockTenantRlsService: jest.Mocked<
    Pick<TenantRlsService, 'setSessionSchoolId' | 'clearSessionSchoolId'>
  >;
  let mockSchoolRepository: { findOne: jest.Mock };
  let mockContextSessionService: jest.Mocked<
    Pick<ContextSessionService, 'getActiveContext' | 'deleteSession' | 'refreshTtl' | 'setActiveContext'>
  >;
  let mockContextService: jest.Mocked<
    Pick<ContextService, 'computeAccessibleSchoolIds'>
  >;
  let mockNext: jest.MockedFunction<NextFunction>;

  const VALID_SCHOOL_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const ANOTHER_SCHOOL_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const USER_SCHOOL_ID = '11111111-2222-3333-4444-555555555555';
  const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeEach(() => {
    tenantContextService = new TenantContextService();

    mockTenantAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    };

    mockTenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
      clearSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    };

    mockSchoolRepository = {
      findOne: jest.fn(),
    };

    mockContextSessionService = {
      getActiveContext: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
      setActiveContext: jest.fn().mockResolvedValue(undefined),
    };

    mockContextService = {
      computeAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    mockNext = jest.fn();

    middleware = new TenantMiddleware(
      tenantContextService,
      mockTenantAudit as unknown as TenantAuditService,
      mockTenantRlsService as unknown as TenantRlsService,
      mockSchoolRepository as unknown as jest.Mocked<
        import('typeorm').Repository<SchoolEntity>
      >,
      mockContextSessionService as unknown as ContextSessionService,
      mockContextService as unknown as ContextService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Factory helpers for test data ---

  function createRequest(
    user?: Record<string, unknown>,
    headers?: Record<string, string>,
    method?: string,
  ): Request {
    return {
      user,
      headers: headers || {},
      method: method || 'GET',
    } as unknown as Request;
  }

  function createResponse(): Response {
    return {} as unknown as Response;
  }

  function createMultiSchoolUser(overrides?: Record<string, unknown>) {
    return {
      id: USER_ID,
      schoolId: USER_SCHOOL_ID,
      role: UserRole.COMPANY_ADMIN,
      accessibleSchoolIds: [USER_SCHOOL_ID, VALID_SCHOOL_ID, ANOTHER_SCHOOL_ID],
      ...overrides,
    };
  }

  function createSingleSchoolUser(role: UserRole, overrides?: Record<string, unknown>) {
    return {
      id: USER_ID,
      schoolId: USER_SCHOOL_ID,
      role,
      ...overrides,
    };
  }

  function createSuperAdmin(overrides?: Record<string, unknown>) {
    return {
      id: USER_ID,
      schoolId: null,
      role: UserRole.SUPER_ADMIN,
      ...overrides,
    };
  }

  function createTeacherWithMultipleSchools(schoolIds: string[]) {
    return {
      id: USER_ID,
      schoolId: schoolIds[0],
      role: UserRole.TEACHER,
      accessibleSchoolIds: schoolIds,
    };
  }

  function createTeacherWithSingleSchool() {
    return {
      id: USER_ID,
      schoolId: USER_SCHOOL_ID,
      role: UserRole.TEACHER,
      accessibleSchoolIds: [USER_SCHOOL_ID],
    };
  }

  /**
   * Create middleware instance WITHOUT ContextSessionService/ContextService
   * to test backward compatibility (ContextModule unavailable).
   */
  function createMiddlewareWithoutContextModule(): TenantMiddleware {
    return new TenantMiddleware(
      tenantContextService,
      mockTenantAudit as unknown as TenantAuditService,
      mockTenantRlsService as unknown as TenantRlsService,
      mockSchoolRepository as unknown as jest.Mocked<
        import('typeorm').Repository<SchoolEntity>
      >,
    );
  }

  describe('Public endpoint (no req.user)', () => {
    it('should call next() without setting tenant context', async () => {
      const req = createRequest(undefined);
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockTenantRlsService.setSessionSchoolId).not.toHaveBeenCalled();
    });
  });

  describe('Non-SUPER_ADMIN user', () => {
    it('should set schoolId from req.user.schoolId', async () => {
      const req = createRequest({
        id: USER_ID,
        schoolId: USER_SCHOOL_ID,
        role: UserRole.SCHOOL_ADMIN,
      });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        USER_SCHOOL_ID,
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should ignore X-School-Id header and use JWT schoolId', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: USER_SCHOOL_ID,
          role: UserRole.SCHOOL_ADMIN,
        },
        { 'x-school-id': VALID_SCHOOL_ID },
      );
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        USER_SCHOOL_ID,
      );
      expect(mockSchoolRepository.findOne).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('SUPER_ADMIN without X-School-Id header', () => {
    it('should set isBypass to true and call setSessionSchoolId with BYPASS', async () => {
      const req = createRequest({
        id: USER_ID,
        schoolId: null,
        role: UserRole.SUPER_ADMIN,
      });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        'BYPASS',
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('SUPER_ADMIN with valid X-School-Id header', () => {
    it('should validate school exists and set schoolId to header value', async () => {
      mockSchoolRepository.findOne.mockResolvedValue({ id: VALID_SCHOOL_ID });

      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': VALID_SCHOOL_ID },
      );
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockSchoolRepository.findOne).toHaveBeenCalledWith({
        where: { id: VALID_SCHOOL_ID },
        select: ['id'],
      });
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        VALID_SCHOOL_ID,
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('SUPER_ADMIN with invalid UUID format in X-School-Id', () => {
    it('should throw BadRequestException for malformed UUID', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': 'not-a-valid-uuid' },
      );
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockSchoolRepository.findOne).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('SUPER_ADMIN with non-existing school UUID', () => {
    it('should throw BadRequestException when school does not exist', async () => {
      mockSchoolRepository.findOne.mockResolvedValue(null);

      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': VALID_SCHOOL_ID },
      );
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockSchoolRepository.findOne).toHaveBeenCalledWith({
        where: { id: VALID_SCHOOL_ID },
        select: ['id'],
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Backward compatibility: req.schoolScope', () => {
    it('should set req.schoolScope for non-SUPER_ADMIN user', async () => {
      const req = createRequest({
        id: USER_ID,
        schoolId: USER_SCHOOL_ID,
        role: UserRole.SCHOOL_ADMIN,
      });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect((req as any).schoolScope).toBe(USER_SCHOOL_ID);
    });

    it('should set req.schoolScope to null for SUPER_ADMIN bypass mode', async () => {
      const req = createRequest({
        id: USER_ID,
        schoolId: null,
        role: UserRole.SUPER_ADMIN,
      });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect((req as any).schoolScope).toBeNull();
    });

    it('should set req.schoolScope to impersonated schoolId for SUPER_ADMIN with X-School-Id', async () => {
      mockSchoolRepository.findOne.mockResolvedValue({ id: VALID_SCHOOL_ID });

      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': VALID_SCHOOL_ID },
      );
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect((req as any).schoolScope).toBe(VALID_SCHOOL_ID);
    });
  });

  describe('TenantRlsService.setSessionSchoolId integration', () => {
    it('should call setSessionSchoolId with the correct schoolId for regular user', async () => {
      const req = createRequest({
        id: USER_ID,
        schoolId: USER_SCHOOL_ID,
        role: UserRole.TEACHER,
      });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledTimes(1);
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        USER_SCHOOL_ID,
      );
    });

    it('should call setSessionSchoolId with BYPASS for SUPER_ADMIN without header', async () => {
      const req = createRequest({
        id: USER_ID,
        schoolId: null,
        role: UserRole.SUPER_ADMIN,
      });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledTimes(1);
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        'BYPASS',
      );
    });

    it('should call setSessionSchoolId with impersonated schoolId for SUPER_ADMIN with valid header', async () => {
      mockSchoolRepository.findOne.mockResolvedValue({ id: VALID_SCHOOL_ID });

      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': VALID_SCHOOL_ID },
      );
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledTimes(1);
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        VALID_SCHOOL_ID,
      );
    });
  });

  describe('Global View mode enforcement (Requirements 5.2, 5.3, 5.5, 5.6)', () => {
    it('should activate Global View for SUPER_ADMIN with X-School-Id: global and GET request', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': 'global' },
      );
      (req as any).method = 'GET';
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        'BYPASS',
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should reject non-GET request (POST) when Global View mode is active', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': 'global' },
      );
      (req as any).method = 'POST';
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        GlobalViewReadonlyException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject non-GET request (PATCH) when Global View mode is active', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': 'global' },
      );
      (req as any).method = 'PATCH';
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        GlobalViewReadonlyException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject non-GET request (DELETE) when Global View mode is active', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': 'global' },
      );
      (req as any).method = 'DELETE';
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        GlobalViewReadonlyException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject non-GET request (PUT) when Global View mode is active', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': 'global' },
      );
      (req as any).method = 'PUT';
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        GlobalViewReadonlyException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw GlobalViewForbiddenException for non-SUPER_ADMIN with X-School-Id: global', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: USER_SCHOOL_ID,
          role: UserRole.SCHOOL_ADMIN,
        },
        { 'x-school-id': 'global' },
      );
      (req as any).method = 'GET';
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        GlobalViewForbiddenException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deactivate Global View when subsequent request has valid school UUID', async () => {
      mockSchoolRepository.findOne.mockResolvedValue({ id: VALID_SCHOOL_ID });

      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': VALID_SCHOOL_ID },
      );
      (req as any).method = 'POST';
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      // Should NOT throw GlobalViewReadonlyException — POST is allowed when not in Global View
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        VALID_SCHOOL_ID,
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should deactivate Global View when subsequent request has no X-School-Id header', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        {},
      );
      (req as any).method = 'POST';
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      // Should NOT throw — SUPER_ADMIN without header goes to bypass mode (not Global View)
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(
        'BYPASS',
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should return HTTP 403 with correct message for Global View readonly violation', async () => {
      const req = createRequest(
        {
          id: USER_ID,
          schoolId: null,
          role: UserRole.SUPER_ADMIN,
        },
        { 'x-school-id': 'global' },
      );
      (req as any).method = 'POST';
      const res = createResponse();

      try {
        await middleware.use(req, res, mockNext);
        fail('Expected GlobalViewReadonlyException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GlobalViewReadonlyException);
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = (error as ForbiddenException).getResponse();
        expect(response).toMatchObject({
          message: 'Không thể thực hiện thao tác ghi trong chế độ Global View',
          errorCode: 'GLOBAL_VIEW_READONLY',
        });
      }
    });
  });

  // =========================================================================
  // NEW TESTS: Priority resolution, session handling, Redis fallback, multi-school
  // Requirements: 3.2, 3.8, 5.1, 5.4, 9.1–9.10, 12.1–12.7
  // =========================================================================

  describe('Priority resolution: header > session > JWT (Requirement 9.1, 3.2)', () => {
    it('should use X-School-Id header over session and JWT for multi-school user', async () => {
      // Session has a different school, but header takes priority
      mockContextSessionService.getActiveContext.mockResolvedValue(ANOTHER_SCHOOL_ID);
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([
        USER_SCHOOL_ID,
        VALID_SCHOOL_ID,
        ANOTHER_SCHOOL_ID,
      ]);

      const user = createMultiSchoolUser();
      const req = createRequest(user, { 'x-school-id': VALID_SCHOOL_ID });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(VALID_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should use session schoolId when no header is present for multi-school user', async () => {
      mockContextSessionService.getActiveContext.mockResolvedValue(VALID_SCHOOL_ID);
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([
        USER_SCHOOL_ID,
        VALID_SCHOOL_ID,
      ]);

      const user = createMultiSchoolUser();
      const req = createRequest(user, {});
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(VALID_SCHOOL_ID);
      expect(mockContextSessionService.refreshTtl).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should fall back to JWT schoolId when no header and no session for non-SUPER_ADMIN', async () => {
      mockContextSessionService.getActiveContext.mockResolvedValue(null);

      const user = createMultiSchoolUser();
      const req = createRequest(user, {});
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should fall back to bypass mode when no header and no session for SUPER_ADMIN', async () => {
      mockContextSessionService.getActiveContext.mockResolvedValue(null);

      const user = createSuperAdmin();
      const req = createRequest(user, {});
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith('BYPASS');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Single-school user ignores X-School-Id header (Requirement 9.10)', () => {
    const singleSchoolRoles = [
      UserRole.SCHOOL_ADMIN,
      UserRole.HR,
      UserRole.SCHEDULER,
      UserRole.VIEWER,
    ];

    it.each(singleSchoolRoles)(
      'should resolve from JWT for %s regardless of X-School-Id header',
      async (role) => {
        const user = createSingleSchoolUser(role);
        const req = createRequest(user, { 'x-school-id': VALID_SCHOOL_ID });
        const res = createResponse();

        await middleware.use(req, res, mockNext);

        expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
        expect(mockContextSessionService.getActiveContext).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledTimes(1);
      },
    );

    it('should resolve from JWT for TEACHER with single accessible school', async () => {
      const user = createTeacherWithSingleSchool();
      const req = createRequest(user, { 'x-school-id': VALID_SCHOOL_ID });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stale session detection and cleanup (Requirement 3.8)', () => {
    it('should delete stale session and fall back to JWT when session schoolId is no longer accessible', async () => {
      const staleSchoolId = 'cccccccc-dddd-eeee-ffff-000000000000';
      mockContextSessionService.getActiveContext.mockResolvedValue(staleSchoolId);
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([
        USER_SCHOOL_ID,
        VALID_SCHOOL_ID,
      ]);

      const user = createMultiSchoolUser();
      const req = createRequest(user, {});
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockContextSessionService.deleteSession).toHaveBeenCalledWith(USER_ID);
      // Falls back to JWT schoolId
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should delete stale "global" session for non-SUPER_ADMIN and fall back to JWT', async () => {
      mockContextSessionService.getActiveContext.mockResolvedValue('global');

      const user = createMultiSchoolUser();
      const req = createRequest(user, {});
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockContextSessionService.deleteSession).toHaveBeenCalledWith(USER_ID);
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should use session "global" value for SUPER_ADMIN and activate Global View', async () => {
      mockContextSessionService.getActiveContext.mockResolvedValue('global');

      const user = createSuperAdmin();
      const req = createRequest(user, {}, 'GET');
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith('BYPASS');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Redis failure fallback to JWT (Requirement 9.6)', () => {
    /**
     * Note: The real ContextSessionService.getActiveContext() handles Redis errors
     * internally (500ms timeout + try-catch → returns null). The middleware relies
     * on this behavior. When Redis fails, getActiveContext returns null, and the
     * middleware falls through to JWT fallback.
     */
    it('should fall back to JWT schoolId when session returns null (Redis timeout scenario)', async () => {
      // Simulate Redis failure: getActiveContext returns null (service handles error internally)
      mockContextSessionService.getActiveContext.mockResolvedValue(null);

      const user = createMultiSchoolUser();
      const req = createRequest(user, {});
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      // Should fall back to JWT schoolId
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should fall back to bypass mode for SUPER_ADMIN when session returns null', async () => {
      // Simulate Redis failure: getActiveContext returns null
      mockContextSessionService.getActiveContext.mockResolvedValue(null);

      const user = createSuperAdmin();
      const req = createRequest(user, {});
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith('BYPASS');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should proceed without error when ContextSessionService is unavailable', async () => {
      // Middleware created without ContextSessionService (Optional dependency)
      const middlewareWithout = createMiddlewareWithoutContextModule();

      const user = createMultiSchoolUser();
      const req = createRequest(user, {});
      const res = createResponse();

      // Should NOT throw — graceful degradation without Redis/ContextModule
      await middlewareWithout.use(req, res, mockNext);
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multi-school user with inaccessible school in header returns 403 (Requirement 9.3)', () => {
    it('should throw ContextForbiddenException when COMPANY_ADMIN sends inaccessible school in header', async () => {
      const inaccessibleSchoolId = 'dddddddd-eeee-ffff-0000-111111111111';
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([
        USER_SCHOOL_ID,
        VALID_SCHOOL_ID,
      ]);

      const user = createMultiSchoolUser();
      const req = createRequest(user, { 'x-school-id': inaccessibleSchoolId });
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        ContextForbiddenException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 with Vietnamese message for inaccessible school', async () => {
      const inaccessibleSchoolId = 'dddddddd-eeee-ffff-0000-111111111111';
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([
        USER_SCHOOL_ID,
      ]);

      const user = createMultiSchoolUser();
      const req = createRequest(user, { 'x-school-id': inaccessibleSchoolId });
      const res = createResponse();

      try {
        await middleware.use(req, res, mockNext);
        fail('Expected ContextForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ContextForbiddenException);
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = (error as ForbiddenException).getResponse();
        expect(response).toMatchObject({
          message: 'Bạn không có quyền truy cập trường này',
          errorCode: 'CONTEXT_FORBIDDEN',
        });
      }
    });

    it('should throw ContextForbiddenException for multi-school TEACHER with inaccessible school', async () => {
      const inaccessibleSchoolId = 'dddddddd-eeee-ffff-0000-111111111111';
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([
        USER_SCHOOL_ID,
        ANOTHER_SCHOOL_ID,
      ]);

      const user = createTeacherWithMultipleSchools([USER_SCHOOL_ID, ANOTHER_SCHOOL_ID]);
      const req = createRequest(user, { 'x-school-id': inaccessibleSchoolId });
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(
        ContextForbiddenException,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid UUID in X-School-Id header returns 400 (Requirement 9.4)', () => {
    it('should throw BadRequestException for non-UUID string in header for multi-school user', async () => {
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([USER_SCHOOL_ID]);

      const user = createMultiSchoolUser();
      const req = createRequest(user, { 'x-school-id': 'not-a-uuid-format' });
      const res = createResponse();

      await expect(middleware.use(req, res, mockNext)).rejects.toThrow(BadRequestException);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should include Vietnamese error message for invalid UUID format', async () => {
      const user = createMultiSchoolUser();
      const req = createRequest(user, { 'x-school-id': 'abc123' });
      const res = createResponse();

      try {
        await middleware.use(req, res, mockNext);
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({
          message: expect.stringContaining('UUID'),
          errorCode: 'INVALID_FORMAT',
        });
      }
    });
  });

  describe('Backward compatibility: existing impersonation still works (Requirement 12.1)', () => {
    it('should allow SUPER_ADMIN to impersonate a school via X-School-Id header', async () => {
      mockSchoolRepository.findOne.mockResolvedValue({ id: VALID_SCHOOL_ID });
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([]);

      const user = createSuperAdmin();
      const req = createRequest(user, { 'x-school-id': VALID_SCHOOL_ID });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect(mockSchoolRepository.findOne).toHaveBeenCalledWith({
        where: { id: VALID_SCHOOL_ID },
        select: ['id'],
      });
      expect(mockTenantAudit.logImpersonation).toHaveBeenCalledWith(USER_ID, VALID_SCHOOL_ID);
      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(VALID_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should set req.schoolScope to impersonated schoolId for SUPER_ADMIN', async () => {
      mockSchoolRepository.findOne.mockResolvedValue({ id: VALID_SCHOOL_ID });
      mockContextService.computeAccessibleSchoolIds.mockResolvedValue([]);

      const user = createSuperAdmin();
      const req = createRequest(user, { 'x-school-id': VALID_SCHOOL_ID });
      const res = createResponse();

      await middleware.use(req, res, mockNext);

      expect((req as any).schoolScope).toBe(VALID_SCHOOL_ID);
    });
  });

  describe('ContextModule unavailable fallback (Requirement 12.7)', () => {
    it('should fall back to JWT-only logic when ContextSessionService is not injected', async () => {
      const middlewareWithout = createMiddlewareWithoutContextModule();

      const req = createRequest({
        id: USER_ID,
        schoolId: USER_SCHOOL_ID,
        role: UserRole.SCHOOL_ADMIN,
      });
      const res = createResponse();

      await middlewareWithout.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith(USER_SCHOOL_ID);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should still allow SUPER_ADMIN bypass when ContextModule is unavailable', async () => {
      const middlewareWithout = createMiddlewareWithoutContextModule();

      const req = createRequest({
        id: USER_ID,
        schoolId: null,
        role: UserRole.SUPER_ADMIN,
      });
      const res = createResponse();

      await middlewareWithout.use(req, res, mockNext);

      expect(mockTenantRlsService.setSessionSchoolId).toHaveBeenCalledWith('BYPASS');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
