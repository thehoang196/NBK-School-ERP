import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Trùng tên tổ bộ môn trong cùng trường.
 * HTTP 409 Conflict
 */
export class DuplicateDepartmentNameException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Tên tổ bộ môn đã tồn tại trong trường. Vui lòng chọn tên khác.',
      HttpStatus.CONFLICT,
    );
  }
}
