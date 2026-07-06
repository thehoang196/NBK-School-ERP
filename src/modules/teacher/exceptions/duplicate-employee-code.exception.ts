import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Trùng mã giáo viên trong cùng trường.
 * HTTP 409 Conflict
 */
export class DuplicateEmployeeCodeException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Mã giáo viên đã tồn tại trong trường. Vui lòng chọn mã khác.',
      HttpStatus.CONFLICT,
    );
  }
}
