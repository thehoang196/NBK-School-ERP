import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { TenantAuditService } from './tenant-audit.service';
import { TenantContextService } from './tenant-context.service';

describe('TenantAuditService', () => {
  let service: TenantAuditService;
  let tenantContext: TenantContextService;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantAuditService, TenantContextService],
    }).compile();

    service = module.get<TenantAuditService>(TenantAuditService);
    tenantContext = module.get<TenantContextService>(TenantContextService);

    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logTenantContextError', () => {
    it('should log with TENANT_CONTEXT_MISSING event and entity name', () => {
      service.logTenantContextError('TeacherEntity');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Tenant context required',
        expect.objectContaining({
          event: 'TENANT_CONTEXT_MISSING',
          entityName: 'TeacherEntity',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should include provided userId, endpoint, and method', () => {
      service.logTenantContextError(
        'ClassEntity',
        'user-123',
        '/api/v1/classes',
        'GET',
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Tenant context required',
        expect.objectContaining({
          event: 'TENANT_CONTEXT_MISSING',
          entityName: 'ClassEntity',
          userId: 'user-123',
          endpoint: '/api/v1/classes',
          method: 'GET',
        }),
      );
    });

    it('should fallback to userId from tenant context when not provided', () => {
      tenantContext.run(
        { schoolId: 'school-1', isBypass: false, userId: 'context-user' },
        () => {
          service.logTenantContextError('SubjectEntity');
        },
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Tenant context required',
        expect.objectContaining({
          userId: 'context-user',
        }),
      );
    });

    it('should log null userId when no user info available', () => {
      service.logTenantContextError('RoomEntity');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Tenant context required',
        expect.objectContaining({
          userId: null,
        }),
      );
    });
  });

  describe('logRlsViolation', () => {
    it('should log with RLS_VIOLATION event and sanitized query', () => {
      const query =
        "SELECT * FROM teachers WHERE school_id = '550e8400-e29b-41d4-a716-446655440000'";

      service.logRlsViolation(query, 'different-school-id', 'user-456');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'RLS policy denied access',
        expect.objectContaining({
          event: 'RLS_VIOLATION',
          query: expect.stringContaining('<REDACTED>'),
          sessionSchoolId: 'different-school-id',
          userId: 'user-456',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should sanitize UUIDs from query', () => {
      const query =
        "SELECT * FROM teachers WHERE school_id = '550e8400-e29b-41d4-a716-446655440000'";

      service.logRlsViolation(query, null);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'RLS policy denied access',
        expect.objectContaining({
          query: "SELECT * FROM teachers WHERE school_id = '<REDACTED>'",
        }),
      );
    });

    it('should sanitize string literals from query', () => {
      const query = "SELECT * FROM teachers WHERE name = 'sensitive name'";

      service.logRlsViolation(query, null);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'RLS policy denied access',
        expect.objectContaining({
          query: "SELECT * FROM teachers WHERE name = '<REDACTED>'",
        }),
      );
    });
  });

  describe('logImpersonation', () => {
    it('should log with IMPERSONATION event and admin details', () => {
      service.logImpersonation('admin-user-123', 'target-school-456');

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Super Admin impersonation activated',
        expect.objectContaining({
          event: 'IMPERSONATION',
          superAdminId: 'admin-user-123',
          targetSchoolId: 'target-school-456',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should include ISO timestamp format', () => {
      const beforeTime = new Date().toISOString();
      service.logImpersonation('admin-1', 'school-1');
      const afterTime = new Date().toISOString();

      const loggedEntry = loggerLogSpy.mock.calls[0][1];
      expect(loggedEntry.timestamp >= beforeTime).toBe(true);
      expect(loggedEntry.timestamp <= afterTime).toBe(true);
    });
  });
});
