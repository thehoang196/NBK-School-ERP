import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * 403 — User does not have access to the target school.
 * Validates: Requirements 2.5, 2.6, 10.4
 */
export class ContextForbiddenException extends ForbiddenException {
  constructor() {
    super({
      success: false,
      data: null,
      message: 'Bạn không có quyền truy cập trường này',
      errorCode: 'CONTEXT_FORBIDDEN',
    });
  }
}

/**
 * 403 — Only SUPER_ADMIN may activate Global View mode.
 * Validates: Requirements 5.4
 */
export class GlobalViewForbiddenException extends ForbiddenException {
  constructor() {
    super({
      success: false,
      data: null,
      message: 'Chỉ SUPER_ADMIN được sử dụng chế độ Global View',
      errorCode: 'GLOBAL_VIEW_FORBIDDEN',
    });
  }
}

/**
 * 403 — Write operations are not permitted in Global View mode.
 * Validates: Requirements 5.3
 */
export class GlobalViewReadonlyException extends ForbiddenException {
  constructor() {
    super({
      success: false,
      data: null,
      message: 'Không thể thực hiện thao tác ghi trong chế độ Global View',
      errorCode: 'GLOBAL_VIEW_READONLY',
    });
  }
}

/**
 * 422 — Target school is currently inactive.
 * Validates: Requirements 2.7
 */
export class SchoolInactiveException extends UnprocessableEntityException {
  constructor() {
    super({
      success: false,
      data: null,
      message: 'Trường học hiện đang ngưng hoạt động',
      errorCode: 'SCHOOL_INACTIVE',
    });
  }
}

/**
 * 403 — Context is invalid, user must re-select school.
 * Validates: Requirements 10.4
 */
export class ContextInvalidException extends ForbiddenException {
  constructor() {
    super({
      success: false,
      data: null,
      message: 'Ngữ cảnh không hợp lệ. Vui lòng chọn lại trường',
      errorCode: 'CONTEXT_INVALID',
    });
  }
}

/**
 * 429 — Too many context switch requests.
 * Validates: Requirements 10.6
 */
export class ContextSwitchRateLimitedException extends HttpException {
  constructor() {
    super(
      {
        success: false,
        data: null,
        message: 'Quá nhiều yêu cầu chuyển đổi. Vui lòng thử lại sau.',
        errorCode: 'CONTEXT_SWITCH_RATE_LIMITED',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
