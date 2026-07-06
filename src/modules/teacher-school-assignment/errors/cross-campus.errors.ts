import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Centralized error factory for Cross-Campus Teaching feature.
 * Each static method returns the appropriate NestJS HTTP exception
 * with Vietnamese error messages and structured error codes.
 */
export class CrossCampusErrors {
  /**
   * 400 — Teacher and school belong to different organizations.
   * Validates: Requirements 1.3, 1.4
   */
  static crossOrgNotAllowed(): BadRequestException {
    return new BadRequestException({
      success: false,
      data: null,
      message: 'Không thể tạo liên kết giữa các trường thuộc tổ chức khác nhau',
      errorCode: 'CROSS_ORG_NOT_ALLOWED',
    });
  }

  /**
   * 400 — Teacher already has 5 secondary school assignments.
   * Validates: Requirements 1.6
   */
  static maxSecondaryExceeded(): BadRequestException {
    return new BadRequestException({
      success: false,
      data: null,
      message: 'Giáo viên đã đạt số trường phụ tối đa (5)',
      errorCode: 'MAX_SECONDARY_EXCEEDED',
    });
  }

  /**
   * 403 — User does not have access to the requested school data.
   * Validates: Requirements 2.5
   */
  static schoolAccessDenied(): ForbiddenException {
    return new ForbiddenException({
      success: false,
      data: null,
      message: 'Bạn không có quyền truy cập dữ liệu trường này',
      errorCode: 'SCHOOL_ACCESS_DENIED',
    });
  }

  /**
   * 403 — Cross-school feature is not enabled for this organization.
   * Validates: Requirements 8.5
   */
  static featureNotEnabled(): ForbiddenException {
    return new ForbiddenException({
      success: false,
      data: null,
      message: 'Tính năng dạy liên trường chưa được kích hoạt cho tổ chức này',
      errorCode: 'FEATURE_NOT_ENABLED',
    });
  }

  /**
   * 403 — Teacher does not have an active assignment for the target school.
   * Validates: Requirements 1.3
   */
  static teacherNoSchoolAssignment(): ForbiddenException {
    return new ForbiddenException({
      success: false,
      data: null,
      message: 'Giáo viên không có quyền dạy tại trường này',
      errorCode: 'TEACHER_NO_SCHOOL_ASSIGNMENT',
    });
  }

  /**
   * 409 — Teacher is already linked to this school.
   * Validates: Requirements 1.3
   */
  static duplicateSchoolAssignment(): ConflictException {
    return new ConflictException({
      success: false,
      data: null,
      message: 'Giáo viên đã được liên kết với trường này',
      errorCode: 'DUPLICATE_SCHOOL_ASSIGNMENT',
    });
  }

  /**
   * 400 — Cannot deactivate the primary school assignment.
   * Validates: Requirements 1.4
   */
  static primaryAssignmentRequired(): BadRequestException {
    return new BadRequestException({
      success: false,
      data: null,
      message: 'Không thể hủy liên kết trường chính của giáo viên',
      errorCode: 'PRIMARY_ASSIGNMENT_REQUIRED',
    });
  }

  /**
   * 401 — JWT token is stale due to assignment changes.
   * Validates: Requirements 2.5
   */
  static tokenStale(): UnauthorizedException {
    return new UnauthorizedException({
      success: false,
      data: null,
      message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      errorCode: 'TOKEN_STALE',
    });
  }

  /**
   * 400 — Total periods across all schools exceed teacher's maximum.
   * Validates: Requirements 1.6
   */
  static workloadExceeded(): BadRequestException {
    return new BadRequestException({
      success: false,
      data: null,
      message: 'Tổng số tiết vượt quá định mức tối đa của giáo viên',
      errorCode: 'WORKLOAD_EXCEEDED',
    });
  }

  /**
   * 409 — Teacher has a timetable slot at another school at the same time.
   * Validates: Requirements 1.3
   */
  static crossSchoolConflict(): ConflictException {
    return new ConflictException({
      success: false,
      data: null,
      message: 'Giáo viên đã có tiết dạy tại trường khác vào thời điểm này',
      errorCode: 'CROSS_SCHOOL_CONFLICT',
    });
  }
}
