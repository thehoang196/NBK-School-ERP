import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when a mutation is attempted on a published TimetableVersion.
 * HTTP 403 Forbidden
 */
export class PublishedVersionImmutableException extends HttpException {
  constructor() {
    const message = 'Phiên bản TKB đã công bố không thể chỉnh sửa.';
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        error: 'Published Version Immutable',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
