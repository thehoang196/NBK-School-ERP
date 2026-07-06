import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: string;
  schoolId: string | null;
  accessibleSchoolIds?: string[];
  tokenVersion?: number;
}

/**
 * Decorator lấy thông tin user hiện tại từ JWT token đã decode.
 * Sử dụng trong controller: @CurrentUser() user: CurrentUserPayload
 * Có thể lấy field cụ thể: @CurrentUser('schoolId') schoolId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: CurrentUserPayload = request.user;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
