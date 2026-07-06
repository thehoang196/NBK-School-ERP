import { HttpException, HttpStatus } from '@nestjs/common';

export class PeriodOverlapException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Tiết học bị trùng thời gian với tiết khác trong cùng ca học và cấp học',
      HttpStatus.CONFLICT,
    );
  }
}
