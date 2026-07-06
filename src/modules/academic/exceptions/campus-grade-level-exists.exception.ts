import { HttpException, HttpStatus } from '@nestjs/common';

export class CampusGradeLevelExistsException extends HttpException {
  constructor(message?: string) {
    super(message || 'Cấp học đã được gán cho cơ sở này', HttpStatus.CONFLICT);
  }
}
