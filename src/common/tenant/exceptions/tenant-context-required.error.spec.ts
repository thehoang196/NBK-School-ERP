import { HttpStatus } from '@nestjs/common';
import { TenantContextRequiredError } from './tenant-context-required.error';

describe('TenantContextRequiredError', () => {
  it('should have HTTP 403 status', () => {
    const error = new TenantContextRequiredError('Teacher');
    expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
  });

  it('should include entity name in Vietnamese error message', () => {
    const error = new TenantContextRequiredError('Teacher');
    const response = error.getResponse() as Record<string, unknown>;
    expect(response.message).toBe(
      'Không thể truy cập Teacher khi chưa xác định tenant context',
    );
  });

  it('should include error type in response', () => {
    const error = new TenantContextRequiredError('AcademicYear');
    const response = error.getResponse() as Record<string, unknown>;
    expect(response.error).toBe('Tenant Context Required');
    expect(response.statusCode).toBe(HttpStatus.FORBIDDEN);
  });

  it('should work with different entity names', () => {
    const entities = ['Campus', 'TimetableSlot', 'TeachingAssignment'];
    for (const entity of entities) {
      const error = new TenantContextRequiredError(entity);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        `Không thể truy cập ${entity} khi chưa xác định tenant context`,
      );
    }
  });
});
