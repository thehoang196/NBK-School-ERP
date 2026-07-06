import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator lấy schoolScope từ request.
 *
 * Nguồn dữ liệu: `request.schoolScope` được set bởi TenantMiddleware
 * (thông qua TenantContextService) trong quá trình xử lý request.
 *
 * TenantMiddleware xác định schoolId từ:
 * - JWT claims (user.schoolId) cho user thường
 * - Header X-School-Id cho SUPER_ADMIN impersonation
 * - null (bypass) cho SUPER_ADMIN không impersonate
 *
 * Giá trị trả về:
 * - string (UUID) — schoolId nếu user thuộc 1 trường cụ thể
 * - null — nếu user là SUPER_ADMIN ở chế độ bypass (full access)
 *
 * Backward compatible: Nếu SchoolScopeGuard cũng chạy và set
 * request.schoolScope thành array, decorator vẫn trả về giá trị từ request.
 *
 * Sử dụng: @SchoolScope() schoolId: string | null
 *
 * Validates: Requirements 6.2, 6.4
 */
export const SchoolScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.schoolScope ?? null;
  },
);
