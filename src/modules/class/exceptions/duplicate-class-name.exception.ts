import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Trùng tên lớp trong cùng khối và năm học.
 * HTTP 409 Conflict
 */
export class DuplicateClassNameException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Tên lớp đã tồn tại trong cùng khối và năm học. Vui lòng chọn tên khác.',
      HttpStatus.CONFLICT,
    );
  }
}
