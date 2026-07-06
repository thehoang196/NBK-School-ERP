import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';

export interface AuditLogOptions {
  action: string;
  entityType: string;
}

/**
 * Decorator đánh dấu method controller cần ghi audit log.
 * Kết hợp với AuditLogInterceptor để tự động ghi log sau khi request thành công.
 *
 * @example
 * @LogAudit({ action: 'create', entityType: 'teacher' })
 * @Post()
 * async create(@Body() dto: CreateTeacherDto) { ... }
 */
export const LogAudit = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_KEY, options);
