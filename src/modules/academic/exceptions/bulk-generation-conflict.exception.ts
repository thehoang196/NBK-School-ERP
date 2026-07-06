import { HttpException, HttpStatus } from '@nestjs/common';

export class BulkGenerationConflictException extends HttpException {
  constructor(message?: string) {
    super(
      message ||
        'Học kỳ đã có tuần học. Vui lòng xóa các tuần hiện tại trước khi tạo lại',
      HttpStatus.CONFLICT,
    );
  }
}
