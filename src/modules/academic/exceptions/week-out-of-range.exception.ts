import { HttpException, HttpStatus } from '@nestjs/common';

export class WeekOutOfRangeException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Ngày của tuần học nằm ngoài phạm vi học kỳ',
      HttpStatus.BAD_REQUEST,
    );
  }
}
