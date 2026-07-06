import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Ngày bắt đầu/kết thúc năm học không hợp lệ.
 * HTTP 400 Bad Request
 */
export class AcademicYearDateConflictException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Ngày bắt đầu và ngày kết thúc năm học không hợp lệ. Ngày bắt đầu phải trước ngày kết thúc.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
