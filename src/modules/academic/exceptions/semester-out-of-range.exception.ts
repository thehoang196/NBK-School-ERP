import { HttpException, HttpStatus } from '@nestjs/common';

export class SemesterOutOfRangeException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Ngày của học kỳ nằm ngoài phạm vi năm học',
      HttpStatus.BAD_REQUEST,
    );
  }
}
