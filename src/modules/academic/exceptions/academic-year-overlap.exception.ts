import { HttpException, HttpStatus } from '@nestjs/common';

export class AcademicYearOverlapException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Năm học bị trùng thời gian với năm học khác trong cùng trường',
      HttpStatus.CONFLICT,
    );
  }
}
