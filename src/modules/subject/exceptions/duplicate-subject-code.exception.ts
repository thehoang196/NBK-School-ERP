import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Trùng mã môn học trong cùng trường.
 * HTTP 409 Conflict
 */
export class DuplicateSubjectCodeException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Mã môn học đã tồn tại trong trường. Vui lòng chọn mã khác.',
      HttpStatus.CONFLICT,
    );
  }
}
