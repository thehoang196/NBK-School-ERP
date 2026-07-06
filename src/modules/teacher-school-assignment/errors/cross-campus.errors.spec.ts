import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { CrossCampusErrors } from './cross-campus.errors';

describe('CrossCampusErrors', () => {
  describe('crossOrgNotAllowed', () => {
    it('should return BadRequestException with correct message and error code', () => {
      const error = CrossCampusErrors.crossOrgNotAllowed();

      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Không thể tạo liên kết giữa các trường thuộc tổ chức khác nhau',
      );
      expect(response.errorCode).toBe('CROSS_ORG_NOT_ALLOWED');
      expect(response.success).toBe(false);
      expect(response.data).toBeNull();
    });
  });

  describe('maxSecondaryExceeded', () => {
    it('should return BadRequestException with correct message and error code', () => {
      const error = CrossCampusErrors.maxSecondaryExceeded();

      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Giáo viên đã đạt số trường phụ tối đa (5)',
      );
      expect(response.errorCode).toBe('MAX_SECONDARY_EXCEEDED');
      expect(response.success).toBe(false);
    });
  });

  describe('schoolAccessDenied', () => {
    it('should return ForbiddenException with correct message and error code', () => {
      const error = CrossCampusErrors.schoolAccessDenied();

      expect(error).toBeInstanceOf(ForbiddenException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Bạn không có quyền truy cập dữ liệu trường này',
      );
      expect(response.errorCode).toBe('SCHOOL_ACCESS_DENIED');
      expect(response.success).toBe(false);
    });
  });

  describe('featureNotEnabled', () => {
    it('should return ForbiddenException with correct message and error code', () => {
      const error = CrossCampusErrors.featureNotEnabled();

      expect(error).toBeInstanceOf(ForbiddenException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Tính năng dạy liên trường chưa được kích hoạt cho tổ chức này',
      );
      expect(response.errorCode).toBe('FEATURE_NOT_ENABLED');
      expect(response.success).toBe(false);
    });
  });

  describe('teacherNoSchoolAssignment', () => {
    it('should return ForbiddenException with correct message and error code', () => {
      const error = CrossCampusErrors.teacherNoSchoolAssignment();

      expect(error).toBeInstanceOf(ForbiddenException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Giáo viên không có quyền dạy tại trường này',
      );
      expect(response.errorCode).toBe('TEACHER_NO_SCHOOL_ASSIGNMENT');
      expect(response.success).toBe(false);
    });
  });

  describe('duplicateSchoolAssignment', () => {
    it('should return ConflictException with correct message and error code', () => {
      const error = CrossCampusErrors.duplicateSchoolAssignment();

      expect(error).toBeInstanceOf(ConflictException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Giáo viên đã được liên kết với trường này',
      );
      expect(response.errorCode).toBe('DUPLICATE_SCHOOL_ASSIGNMENT');
      expect(response.success).toBe(false);
    });
  });

  describe('primaryAssignmentRequired', () => {
    it('should return BadRequestException with correct message and error code', () => {
      const error = CrossCampusErrors.primaryAssignmentRequired();

      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Không thể hủy liên kết trường chính của giáo viên',
      );
      expect(response.errorCode).toBe('PRIMARY_ASSIGNMENT_REQUIRED');
      expect(response.success).toBe(false);
    });
  });

  describe('tokenStale', () => {
    it('should return UnauthorizedException with correct message and error code', () => {
      const error = CrossCampusErrors.tokenStale();

      expect(error).toBeInstanceOf(UnauthorizedException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      );
      expect(response.errorCode).toBe('TOKEN_STALE');
      expect(response.success).toBe(false);
    });
  });

  describe('workloadExceeded', () => {
    it('should return BadRequestException with correct message and error code', () => {
      const error = CrossCampusErrors.workloadExceeded();

      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Tổng số tiết vượt quá định mức tối đa của giáo viên',
      );
      expect(response.errorCode).toBe('WORKLOAD_EXCEEDED');
      expect(response.success).toBe(false);
    });
  });

  describe('crossSchoolConflict', () => {
    it('should return ConflictException with correct message and error code', () => {
      const error = CrossCampusErrors.crossSchoolConflict();

      expect(error).toBeInstanceOf(ConflictException);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Giáo viên đã có tiết dạy tại trường khác vào thời điểm này',
      );
      expect(response.errorCode).toBe('CROSS_SCHOOL_CONFLICT');
      expect(response.success).toBe(false);
    });
  });
});
