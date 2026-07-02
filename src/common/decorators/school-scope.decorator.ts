import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator lấy schoolScope từ request (được set bởi SchoolScopeGuard).
 * - Trả về schoolId (string) nếu user thuộc 1 trường cụ thể
 * - Trả về null nếu user là SUPER_ADMIN (có quyền truy cập tất cả)
 *
 * Sử dụng: @SchoolScope() schoolId: string | null
 */
export const SchoolScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.schoolScope ?? null;
  },
);
