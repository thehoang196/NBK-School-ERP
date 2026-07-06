import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Ngày học kỳ nằm ngoài phạm vi năm học.
 * HTTP 400 Bad Request
 */
export class SemesterDateOutOfRangeException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Ngày bắt đầu hoặc ngày kết thúc của học kỳ nằm ngoài phạm vi năm học.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
