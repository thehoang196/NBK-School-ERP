import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when generation input data fails validation (missing or invalid fields).
 * HTTP 400 Bad Request
 */
export class GenerationValidationException extends HttpException {
  constructor(fields: string[]) {
    const message = `Dữ liệu đầu vào thiếu: ${fields.join(', ')}`;
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Generation Validation Error',
        fields,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
