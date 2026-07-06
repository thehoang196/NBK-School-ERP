import { HttpException, HttpStatus } from '@nestjs/common';

export class WeekOverlapException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Tuần học bị trùng ngày với tuần khác trong cùng học kỳ',
      HttpStatus.CONFLICT,
    );
  }
}
