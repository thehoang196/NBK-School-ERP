import { HttpException, HttpStatus } from '@nestjs/common';

export class CampusGradeLevelNotFoundException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Không tìm thấy liên kết cơ sở - cấp học',
      HttpStatus.NOT_FOUND,
    );
  }
}
