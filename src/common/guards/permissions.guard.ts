import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, ROLE_PERMISSIONS } from '../enums/permission.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * PermissionsGuard — kiểm tra permission chi tiết dựa trên role → permission mapping.
 *
 * Guard này đọc `@RequirePermissions(...)` decorator trên handler/class,
 * lấy role từ request.user, tra cứu ROLE_PERMISSIONS để xác định user có
 * đủ permission hay không.
 *
 * Nếu không có decorator → cho phép (public endpoint hoặc chỉ cần auth).
 * Nếu user thiếu permission → throw 403.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập dữ liệu này.',
      );
    }

    const userRole: string = user.role;
    const userPermissions: Permission[] = ROLE_PERMISSIONS[userRole] || [];

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này.',
      );
    }

    return true;
  }
}
