import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidWeekTypeException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Loại tuần không hợp lệ. Giá trị hợp lệ: regular, exam, holiday, makeup',
      HttpStatus.BAD_REQUEST,
    );
  }
}
