import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums/role.enum';

/**
 * Guard xử lý Data Scope theo school_id:
 * - SUPER_ADMIN: Không filter, truy cập tất cả trường
 * - SCHOOL_ADMIN, SCHEDULER, TEACHER, VIEWER: Tự động gắn schoolId từ JWT
 *   vào request để controller/service dùng filter dữ liệu theo trường
 *
 * Sau khi guard chạy, controller có thể lấy:
 *   request.schoolScope — schoolId để filter (null nếu super_admin)
 */
@Injectable()
export class SchoolScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let JwtAuthGuard handle unauthorized
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      // Super admin không bị filter theo school
      request.schoolScope = null;
    } else {
      // Các role khác chỉ được xem dữ liệu của trường mình
      request.schoolScope = user.schoolId;
    }

    return true;
  }
}
