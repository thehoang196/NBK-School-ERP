import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogService } from '../services/audit-log.service';
import {
  AUDIT_LOG_KEY,
  AuditLogOptions,
} from '../decorators/log-audit.decorator';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';

/**
 * Interceptor tự động ghi audit log cho các handler được đánh dấu @LogAudit().
 * Ghi log SAU khi request xử lý thành công (trong tap).
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditOptions = this.reflector.get<AuditLogOptions | undefined>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as unknown as Record<string, unknown>)['user'] as
      | CurrentUserPayload
      | undefined;
    const ipAddress =
      (request.headers['x-forwarded-for'] as string | undefined) ||
      request.socket.remoteAddress ||
      null;
    const userAgent = (request.headers['user-agent'] as string | undefined) || null;

    return next.handle().pipe(
      tap((responseData) => {
        const entityId = this.extractEntityId(request, responseData);
        const schoolScope = (request as unknown as Record<string, unknown>)[
          'schoolScope'
        ] as string[] | null;
        const schoolId =
          schoolScope && schoolScope.length === 1 ? schoolScope[0] : null;

        this.auditLogService
          .log({
            userId: user?.id ?? null,
            schoolId: schoolId ?? user?.schoolId ?? null,
            action: auditOptions.action,
            entityType: auditOptions.entityType,
            entityId: entityId ?? null,
            changes: this.extractChanges(request),
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
          })
          .catch((err) => {
            this.logger.error('Audit log interceptor error', err);
          });
      }),
    );
  }

  private extractEntityId(
    request: Request,
    responseData: unknown,
  ): string | null {
    // From URL params (for update/delete)
    const paramId = request.params['id'];
    if (paramId && typeof paramId === 'string') {
      return paramId;
    }

    // From response data (for create)
    if (
      responseData &&
      typeof responseData === 'object' &&
      'id' in responseData
    ) {
      return (responseData as Record<string, unknown>)['id'] as string;
    }

    if (
      responseData &&
      typeof responseData === 'object' &&
      'data' in responseData
    ) {
      const data = (responseData as Record<string, unknown>)['data'];
      if (data && typeof data === 'object' && 'id' in data) {
        return (data as Record<string, unknown>)['id'] as string;
      }
    }

    return null;
  }

  private extractChanges(
    request: Request,
  ): Record<string, { old: unknown; new: unknown }> | null {
    if (request.method === 'POST' || request.method === 'PATCH') {
      const body = request.body as Record<string, unknown> | undefined;
      if (body && Object.keys(body).length > 0) {
        const changes: Record<string, { old: unknown; new: unknown }> = {};
        for (const [key, value] of Object.entries(body)) {
          changes[key] = { old: null, new: value };
        }
        return changes;
      }
    }
    return null;
  }
}
