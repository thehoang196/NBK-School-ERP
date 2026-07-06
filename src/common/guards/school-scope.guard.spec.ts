import { ExecutionContext } from '@nestjs/common';
import { SchoolScopeGuard } from './school-scope.guard';
import { UserRole } from '../enums/role.enum';
import { TokenInvalidationService } from '../../modules/auth/services/token-invalidation.service';

describe('SchoolScopeGuard', () => {
  let guard: SchoolScopeGuard;
  let mockTokenInvalidationService: jest.Mocked<TokenInvalidationService>;

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
});
