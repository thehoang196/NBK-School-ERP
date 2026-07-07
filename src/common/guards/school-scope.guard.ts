import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Optional,
  Logger,
} from '@nestjs/common';
import { UserRole } from '../enums/role.enum';
import { TokenInvalidationService } from '../../modules/auth/services/token-invalidation.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CrossCampusErrors } from '../../modules/teacher-school-assignment/errors/cross-campus.errors';

/**
 * @deprecated Sử dụng TenantMiddleware thay thế. Guard này được giữ lại để
 * đảm bảo backward compatibility với các controller đã sử dụng trực tiếp.
 *
 * Khi TenantMiddleware đã được áp dụng (mặc định cho tất cả routes),
 * guard này sẽ đọc tenant context từ TenantContextService thay vì
 * tự tính toán lại từ JWT. Nếu TenantContextService không khả dụng
 * (ví dụ TenantModule chưa được đăng ký), guard sẽ fallback về logic cũ.
 *
 * Guard xử lý Data Scope theo school_id (v2 — Multi-School):
 * - SUPER_ADMIN: schoolScope = null (full access)
 * - COMPANY_ADMIN: schoolScope = accessibleSchoolIds array (multi-school role, computed from companySchoolId hierarchy)
 * - Các role khác:
 *   1. Nếu JWT có `accessibleSchoolIds` → schoolScope = accessibleSchoolIds array
 *   2. Nếu JWT không có `accessibleSchoolIds` → fallback schoolScope = [user.schoolId] (backward compat)
 *
 * Token staleness check:
 * - Nếu user.tokenVersion tồn tại, kiểm tra qua TokenInvalidationService
 * - Nếu token bị invalidate → throw UnauthorizedException (TOKEN_STALE)
 *
 * Sau khi guard chạy, controller có thể lấy:
 *   request.schoolScope — string[] (array of school IDs) hoặc null (SUPER_ADMIN)
 *
 * Validates: Requirements 2.2, 2.4, 2.5, 6.2, 6.4, 8.4
 */
@Injectable()
export class SchoolScopeGuard implements CanActivate {
  private readonly logger = new Logger(SchoolScopeGuard.name);

  constructor(
    @Optional()
    private readonly tokenInvalidationService?: TokenInvalidationService,
    @Optional()
    private readonly tenantContextService?: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let JwtAuthGuard handle unauthorized
    }

    // Token staleness check (Requirement 2.4)
    if (this.tokenInvalidationService && user.tokenVersion) {
      // tokenVersion is JWT `iat` in seconds; invalidatedAt is in milliseconds
      const tokenIssuedAtMs = user.tokenVersion * 1000;
      const isValid = await this.tokenInvalidationService.isTokenValid(
        user.id || user.userId,
        tokenIssuedAtMs,
      );
      if (!isValid) {
        throw CrossCampusErrors.tokenStale();
      }
    }

    // Delegate to TenantContextService if available and active (Requirement 6.2, 6.4)
    // TenantMiddleware runs before guards and sets context + request.schoolScope
    if (this.tenantContextService && this.tenantContextService.isActive()) {
      // TenantMiddleware already set request.schoolScope — just ensure it's present
      if (request.schoolScope === undefined) {
        const schoolId = this.tenantContextService.getSchoolId();
        request.schoolScope = schoolId;
      }
      return true;
    }

    // Fallback: original logic when TenantContextService is not available
    // SUPER_ADMIN: full access, no school filter
    if (user.role === UserRole.SUPER_ADMIN) {
      request.schoolScope = null;
      return true;
    }

    // COMPANY_ADMIN: multi-school role (Requirement 12.4, 12.5)
    // Uses accessibleSchoolIds from JWT (populated at login from companySchoolId hierarchy)
    if (user.role === UserRole.COMPANY_ADMIN) {
      if (user.accessibleSchoolIds && user.accessibleSchoolIds.length > 0) {
        request.schoolScope = user.accessibleSchoolIds;
      } else {
        // COMPANY_ADMIN without accessibleSchoolIds: log warning, return empty scope
        // This can happen if companySchoolId is null or has no children
        this.logger.warn(
          `COMPANY_ADMIN user ${user.id || user.userId} has no accessibleSchoolIds in JWT. ` +
          `companySchoolId may be null or invalid.`,
        );
        request.schoolScope = user.schoolId ? [user.schoolId] : [];
      }
      return true;
    }

    // Multi-school access for other roles (TEACHER, etc.) (Requirement 2.2)
    if (user.accessibleSchoolIds && user.accessibleSchoolIds.length > 0) {
      request.schoolScope = user.accessibleSchoolIds;
    } else {
      // Backward compatibility (Requirement 8.4): fallback to single schoolId
      request.schoolScope = user.schoolId ? [user.schoolId] : null;
    }

    return true;
  }
}
