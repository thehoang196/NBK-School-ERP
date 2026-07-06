import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidDateRangeException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Ngày bắt đầu phải trước ngày kết thúc',
      HttpStatus.BAD_REQUEST,
    );
  }
}
