import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when an invalid state transition is attempted on a TimetableVersion.
 * HTTP 422 Unprocessable Entity
 */
export class InvalidStateTransitionException extends HttpException {
  constructor(current: string, target: string) {
    const message = `Không thể chuyển trạng thái từ '${current}' sang '${target}'.`;
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message,
        error: 'Invalid State Transition',
        currentStatus: current,
        targetStatus: target,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
