import { ExecutionContext } from '@nestjs/common';
import { SchoolScopeGuard } from './school-scope.guard';
import { UserRole } from '../enums/role.enum';
import { TokenInvalidationService } from '../../modules/auth/services/token-invalidation.service';
import { TenantContextService } from '../tenant/tenant-context.service';

describe('SchoolScopeGuard', () => {
  let guard: SchoolScopeGuard;
  let mockTokenInvalidationService: jest.Mocked<TokenInvalidationService>;
  let mockTenantContextService: jest.Mocked<TenantContextService>;

  function createMockContext(user: Record<string, unknown> | null): {
    context: ExecutionContext;
    request: Record<string, unknown>;
  } {
    const request: Record<string, unknown> = { user };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    mockTokenInvalidationService = {
      isTokenValid: jest.fn().mockResolvedValue(true),
      invalidateUserTokens: jest.fn().mockResolvedValue(undefined),
      clearInvalidation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TokenInvalidationService>;

    mockTenantContextService = {
      run: jest.fn(),
      getStore: jest.fn(),
      getSchoolId: jest.fn(),
      isBypass: jest.fn(),
      isActive: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<TenantContextService>;

    guard = new SchoolScopeGuard(mockTokenInvalidationService);
  });

  describe('No user (unauthenticated)', () => {
    it('should return true and not set schoolScope when user is null', async () => {
      const { context, request } = createMockContext(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toBeUndefined();
    });
  });

  describe('SUPER_ADMIN', () => {
    it('should set schoolScope to null for full access', async () => {
      const { context, request } = createMockContext({
        id: 'admin-1',
        role: UserRole.SUPER_ADMIN,
        schoolId: 'school-1',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toBeNull();
    });

    it('should still check token validity for SUPER_ADMIN', async () => {
      mockTokenInvalidationService.isTokenValid.mockResolvedValue(false);
      const { context } = createMockContext({
        id: 'admin-1',
        role: UserRole.SUPER_ADMIN,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      );
    });
  });

  describe('Multi-school access (accessibleSchoolIds in JWT)', () => {
    it('should set schoolScope to accessibleSchoolIds array when present', async () => {
      const accessibleSchoolIds = ['school-1', 'school-2', 'school-3'];
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        accessibleSchoolIds,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(accessibleSchoolIds);
    });

    it('should fallback to [user.schoolId] when accessibleSchoolIds is empty array', async () => {
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        accessibleSchoolIds: [],
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['school-1']);
    });
  });

  describe('Backward compatibility (Requirement 8.4)', () => {
    it('should fallback to [user.schoolId] when accessibleSchoolIds is not in JWT', async () => {
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['school-1']);
    });

    it('should set schoolScope to null when no schoolId and no accessibleSchoolIds', async () => {
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toBeNull();
    });
  });

  describe('Token invalidation check (Requirement 2.4)', () => {
    it('should allow request when token is valid', async () => {
      mockTokenInvalidationService.isTokenValid.mockResolvedValue(true);
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockTokenInvalidationService.isTokenValid).toHaveBeenCalledWith(
        'teacher-1',
        1700000000 * 1000,
      );
      expect(request.schoolScope).toEqual(['school-1']);
    });

    it('should reject request with TOKEN_STALE when token is invalidated', async () => {
      mockTokenInvalidationService.isTokenValid.mockResolvedValue(false);
      const { context } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      );
    });

    it('should skip token validation when tokenVersion is not present', async () => {
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockTokenInvalidationService.isTokenValid).not.toHaveBeenCalled();
      expect(request.schoolScope).toEqual(['school-1']);
    });

    it('should use userId field when id is not present', async () => {
      mockTokenInvalidationService.isTokenValid.mockResolvedValue(true);
      const { context } = createMockContext({
        userId: 'user-123',
        role: UserRole.SCHEDULER,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
      });

      await guard.canActivate(context);

      expect(mockTokenInvalidationService.isTokenValid).toHaveBeenCalledWith(
        'user-123',
        1700000000 * 1000,
      );
    });
  });

  describe('Without TokenInvalidationService (optional injection)', () => {
    it('should work without TokenInvalidationService', async () => {
      const guardWithoutService = new SchoolScopeGuard(undefined);
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
        accessibleSchoolIds: ['school-1', 'school-2'],
      });

      const result = await guardWithoutService.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['school-1', 'school-2']);
    });
  });

  describe('SCHOOL_ADMIN role', () => {
    it('should use accessibleSchoolIds when present', async () => {
      const accessibleSchoolIds = ['school-1', 'school-2'];
      const { context, request } = createMockContext({
        id: 'admin-1',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'school-1',
        accessibleSchoolIds,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(accessibleSchoolIds);
    });

    it('should fallback to [schoolId] for SCHOOL_ADMIN without accessibleSchoolIds', async () => {
      const { context, request } = createMockContext({
        id: 'admin-1',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'school-1',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['school-1']);
    });
  });

  describe('COMPANY_ADMIN role (multi-school)', () => {
    it('should set schoolScope to accessibleSchoolIds array when present', async () => {
      const accessibleSchoolIds = ['company-node', 'school-1', 'school-2', 'school-3'];
      const { context, request } = createMockContext({
        id: 'company-admin-1',
        role: UserRole.COMPANY_ADMIN,
        schoolId: 'company-node',
        companySchoolId: 'company-node',
        accessibleSchoolIds,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(accessibleSchoolIds);
    });

    it('should fallback to [schoolId] when COMPANY_ADMIN has no accessibleSchoolIds', async () => {
      const { context, request } = createMockContext({
        id: 'company-admin-1',
        role: UserRole.COMPANY_ADMIN,
        schoolId: 'company-node',
        companySchoolId: 'company-node',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['company-node']);
    });

    it('should return empty array when COMPANY_ADMIN has no accessibleSchoolIds and no schoolId', async () => {
      const { context, request } = createMockContext({
        id: 'company-admin-1',
        role: UserRole.COMPANY_ADMIN,
        companySchoolId: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual([]);
    });

    it('should set schoolScope to accessibleSchoolIds even with empty companySchoolId', async () => {
      const accessibleSchoolIds = ['school-a', 'school-b'];
      const { context, request } = createMockContext({
        id: 'company-admin-1',
        role: UserRole.COMPANY_ADMIN,
        schoolId: 'school-a',
        companySchoolId: null,
        accessibleSchoolIds,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(accessibleSchoolIds);
    });

    it('should still check token validity for COMPANY_ADMIN', async () => {
      mockTokenInvalidationService.isTokenValid.mockResolvedValue(false);
      const { context } = createMockContext({
        id: 'company-admin-1',
        role: UserRole.COMPANY_ADMIN,
        schoolId: 'company-node',
        companySchoolId: 'company-node',
        accessibleSchoolIds: ['company-node', 'school-1'],
        tokenVersion: 1700000000,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      );
    });

    it('should not treat COMPANY_ADMIN as SUPER_ADMIN bypass', async () => {
      const accessibleSchoolIds = ['company-node', 'school-1'];
      const { context, request } = createMockContext({
        id: 'company-admin-1',
        role: UserRole.COMPANY_ADMIN,
        schoolId: 'company-node',
        companySchoolId: 'company-node',
        accessibleSchoolIds,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Should NOT be null (bypass) — should be an array
      expect(request.schoolScope).not.toBeNull();
      expect(request.schoolScope).toEqual(accessibleSchoolIds);
    });
  });

  describe('TenantContextService delegation (Requirements 6.2, 6.4)', () => {
    let guardWithTenant: SchoolScopeGuard;

    beforeEach(() => {
      guardWithTenant = new SchoolScopeGuard(
        mockTokenInvalidationService,
        mockTenantContextService,
      );
    });

    it('should pass through when TenantContextService is active and request.schoolScope is already set', async () => {
      mockTenantContextService.isActive.mockReturnValue(true);
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
      });
      // Simulate TenantMiddleware already set request.schoolScope
      request.schoolScope = 'school-1';

      const result = await guardWithTenant.canActivate(context);

      expect(result).toBe(true);
      // schoolScope should remain the value set by TenantMiddleware
      expect(request.schoolScope).toBe('school-1');
      // Should NOT call getSchoolId since schoolScope was already set
      expect(mockTenantContextService.getSchoolId).not.toHaveBeenCalled();
    });

    it('should set request.schoolScope from TenantContextService when active but schoolScope is undefined', async () => {
      mockTenantContextService.isActive.mockReturnValue(true);
      mockTenantContextService.getSchoolId.mockReturnValue('school-from-context');
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
      });
      // request.schoolScope is undefined (TenantMiddleware didn't set it)

      const result = await guardWithTenant.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toBe('school-from-context');
      expect(mockTenantContextService.getSchoolId).toHaveBeenCalled();
    });

    it('should set request.schoolScope to null when TenantContextService returns null (bypass mode)', async () => {
      mockTenantContextService.isActive.mockReturnValue(true);
      mockTenantContextService.getSchoolId.mockReturnValue(null);
      const { context, request } = createMockContext({
        id: 'admin-1',
        role: UserRole.SUPER_ADMIN,
        tokenVersion: 1700000000,
      });

      const result = await guardWithTenant.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toBeNull();
    });

    it('should still perform token staleness check before delegating to TenantContextService', async () => {
      mockTenantContextService.isActive.mockReturnValue(true);
      mockTokenInvalidationService.isTokenValid.mockResolvedValue(false);
      const { context } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        tokenVersion: 1700000000,
      });

      await expect(guardWithTenant.canActivate(context)).rejects.toThrow(
        'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      );
    });

    it('should fallback to original logic when TenantContextService is injected but NOT active', async () => {
      mockTenantContextService.isActive.mockReturnValue(false);
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        accessibleSchoolIds: ['school-1', 'school-2'],
      });

      const result = await guardWithTenant.canActivate(context);

      expect(result).toBe(true);
      // Should fallback to original multi-school logic
      expect(request.schoolScope).toEqual(['school-1', 'school-2']);
    });

    it('should fallback to SUPER_ADMIN null scope when TenantContextService is not active', async () => {
      mockTenantContextService.isActive.mockReturnValue(false);
      const { context, request } = createMockContext({
        id: 'admin-1',
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      });

      const result = await guardWithTenant.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toBeNull();
    });

    it('should not delegate when TenantContextService is undefined (not injected)', async () => {
      const guardWithoutTenant = new SchoolScopeGuard(
        mockTokenInvalidationService,
        undefined,
      );
      const { context, request } = createMockContext({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        schoolId: 'school-1',
      });

      const result = await guardWithoutTenant.canActivate(context);

      expect(result).toBe(true);
      expect(request.schoolScope).toEqual(['school-1']);
      expect(mockTenantContextService.isActive).not.toHaveBeenCalled();
    });
  });
});
