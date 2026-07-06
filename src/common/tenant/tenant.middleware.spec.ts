import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { TenantMiddleware } from './tenant.middleware';
import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantRlsService } from './tenant-rls.service';
import { UserRole } from '../enums/role.enum';
import { SchoolEntity } from '../../modules/school/entities/school.entity';

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
  let mockNext: jest.MockedFunction<NextFunction>;

  const VALID_SCHOOL_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
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

    mockNext = jest.fn();

    middleware = new TenantMiddleware(
      tenantContextService,
      mockTenantAudit as unknown as TenantAuditService,
      mockTenantRlsService as unknown as TenantRlsService,
      mockSchoolRepository as unknown as jest.Mocked<
        import('typeorm').Repository<SchoolEntity>
      >,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(
    user?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Request {
    return {
      user,
      headers: headers || {},
    } as unknown as Request;
  }

  function createResponse(): Response {
    return {} as unknown as Response;
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
});
