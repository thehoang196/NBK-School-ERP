import { HttpException, HttpStatus } from '@nestjs/common';
import { Conflict } from '../interfaces/conflict.interface';

/**
 * Base class for all conflict detection exceptions.
 * Returns a standard error response format with Vietnamese messages.
 */
abstract class ConflictBaseException extends HttpException {
  constructor(
    message: string,
    errorCode: string,
    status: HttpStatus,
    data?: {
      conflicts?: Conflict[];
      hasHardConflicts?: boolean;
      hasSoftConflicts?: boolean;
    },
  ) {
    super(
      {
        success: false,
        data: data ?? null,
        message,
        errorCode,
      },
      status,
    );
  }
}

/**
 * 422 — Hard conflict detected, blocks save operation.
 */
export class HardConflictDetectedException extends ConflictBaseException {
  constructor(conflicts: Conflict[]) {
    super(
      'Phát hiện xung đột cứng, không thể lưu',
      'HARD_CONFLICT_DETECTED',
      HttpStatus.UNPROCESSABLE_ENTITY,
      {
        conflicts,
        hasHardConflicts: true,
        hasSoftConflicts: conflicts.some((c) => c.severity === 'warning'),
      },
    );
  }
}

/**
 * 422 — Soft conflict requires override reason to proceed.
 */
export class SoftConflictRequiresOverrideException extends ConflictBaseException {
  constructor(conflicts: Conflict[]) {
    super(
      'Có cảnh báo xung đột mềm, cần cung cấp lý do ghi đè',
      'SOFT_CONFLICT_REQUIRES_OVERRIDE',
      HttpStatus.UNPROCESSABLE_ENTITY,
      {
        conflicts,
        hasHardConflicts: false,
        hasSoftConflicts: true,
      },
    );
  }
}

/**
 * 400 — Override reason is too short (must be at least 10 characters).
 */
export class OverrideReasonTooShortException extends ConflictBaseException {
  constructor() {
    super(
      'Lý do ghi đè phải có ít nhất 10 ký tự',
      'OVERRIDE_REASON_TOO_SHORT',
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 404 — Timetable version not found.
 */
export class VersionNotFoundException extends ConflictBaseException {
  constructor() {
    super(
      'Không tìm thấy phiên bản thời khóa biểu',
      'VERSION_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * 408 — Validation timeout (full-version check exceeded 10s).
 */
export class ValidationTimeoutException extends ConflictBaseException {
  constructor() {
    super(
      'Kiểm tra xung đột quá thời gian cho phép',
      'VALIDATION_TIMEOUT',
      HttpStatus.REQUEST_TIMEOUT,
    );
  }
}

/**
 * 403 — Request lacks valid school context (schoolId).
 */
export class SchoolContextRequiredException extends ConflictBaseException {
  constructor() {
    super(
      'Không có quyền truy cập — thiếu thông tin trường',
      'SCHOOL_CONTEXT_REQUIRED',
      HttpStatus.FORBIDDEN,
    );
  }
}
