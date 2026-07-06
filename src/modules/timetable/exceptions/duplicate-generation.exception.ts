import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when a generation request is submitted while another is already in progress
 * for the same school and semester.
 * HTTP 409 Conflict
 */
export class DuplicateGenerationException extends HttpException {
  constructor() {
    const message =
      'Đang có quá trình sinh TKB khác cho học kỳ này. Vui lòng chờ hoàn thành.';
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message,
        error: 'Duplicate Generation',
      },
      HttpStatus.CONFLICT,
    );
  }
}
