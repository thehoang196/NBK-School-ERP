import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lỗi khi truy cập entity thuộc tenant mà chưa xác định tenant context.
 * HTTP 403 Forbidden
 */
export class TenantContextRequiredError extends HttpException {
  constructor(entityName: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Tenant Context Required',
        message: `Không thể truy cập ${entityName} khi chưa xác định tenant context`,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
