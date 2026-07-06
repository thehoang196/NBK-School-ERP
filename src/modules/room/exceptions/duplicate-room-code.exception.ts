import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Trùng mã phòng học trong cùng trường.
 * HTTP 409 Conflict
 */
export class DuplicateRoomCodeException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Mã phòng học đã tồn tại trong trường. Vui lòng chọn mã khác.',
      HttpStatus.CONFLICT,
    );
  }
}
