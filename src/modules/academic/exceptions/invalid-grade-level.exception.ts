import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidGradeLevelException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Cấp học không hợp lệ. Giá trị hợp lệ: primary, middle_school, high_school',
      HttpStatus.BAD_REQUEST,
    );
  }
}
