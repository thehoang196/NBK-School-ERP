import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidStatusTransitionException extends HttpException {
  constructor(currentStatus?: string, targetStatus?: string) {
    const message =
      currentStatus && targetStatus
        ? `Không thể chuyển trạng thái từ "${currentStatus}" sang "${targetStatus}". Các chuyển đổi hợp lệ: planning → active → completed`
        : 'Chuyển đổi trạng thái năm học không hợp lệ. Các chuyển đổi hợp lệ: planning → active → completed';
    super(message, HttpStatus.BAD_REQUEST);
  }
}
