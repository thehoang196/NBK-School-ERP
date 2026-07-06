import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * CorrelationIdInterceptor — Gán correlation ID cho mỗi request.
 *
 * Nếu client gửi header `X-Correlation-Id`, sử dụng giá trị đó.
 * Nếu không có, sinh UUID mới.
 *
 * Log structured: requestId, userId, schoolId, method, path, statusCode, duration.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Get or generate correlation ID
    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) || randomUUID();

    // Attach to request for downstream use
    (request as unknown as Record<string, unknown>)['correlationId'] = correlationId;

    // Set response header
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(request, response, startTime, correlationId);
        },
        error: () => {
          this.logRequest(request, response, startTime, correlationId);
        },
      }),
    );
  }

  private logRequest(
    request: Request,
    response: Response,
    startTime: number,
    correlationId: string,
  ): void {
    const duration = Date.now() - startTime;
    const user = (request as unknown as Record<string, unknown>)['user'] as
      | { id?: string; schoolId?: string }
      | undefined;
    const statusCode = response.statusCode;

    this.logger.log({
      requestId: correlationId,
      userId: user?.id ?? null,
      schoolId: user?.schoolId ?? null,
      method: request.method,
      path: request.url,
      statusCode,
      duration: `${duration}ms`,
    });
  }
}
