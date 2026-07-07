import { CorrelationIdInterceptor } from './correlation-id.interceptor';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Request, Response } from 'express';

// ─── Test Factories ────────────────────────────────────────────────────────────

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    method: 'GET',
    url: '/api/v1/context/current',
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    getHeader: (key: string) => headers[key],
    __headers: headers,
  } as unknown as Response & { __headers: Record<string, string> };
}

function createMockExecutionContext(
  request: Request,
  response: Response,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as unknown as ExecutionContext;
}

function createMockCallHandler(returnValue: unknown = {}): CallHandler {
  return {
    handle: () => of(returnValue),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CorrelationIdInterceptor', () => {
  let interceptor: CorrelationIdInterceptor;

  beforeEach(() => {
    interceptor = new CorrelationIdInterceptor();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('correlationId generation', () => {
    it('should generate a UUID correlationId when client does not provide one', (done) => {
      const request = createMockRequest({ headers: {} });
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        const correlationId = (request as unknown as Record<string, unknown>)[
          'correlationId'
        ] as string;
        // Should be a valid UUID v4 format
        expect(correlationId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        done();
      });
    });

    it('should use client-provided X-Correlation-Id header when present', (done) => {
      const clientCorrelationId = 'client-provided-correlation-id-123';
      const request = createMockRequest({
        headers: { 'x-correlation-id': clientCorrelationId },
      });
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        const correlationId = (request as unknown as Record<string, unknown>)[
          'correlationId'
        ] as string;
        expect(correlationId).toBe(clientCorrelationId);
        done();
      });
    });
  });

  describe('correlationId attachment to request', () => {
    it('should attach correlationId to request object for downstream use', (done) => {
      const request = createMockRequest({ headers: {} });
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        expect(
          (request as unknown as Record<string, unknown>)['correlationId'],
        ).toBeDefined();
        expect(
          typeof (request as unknown as Record<string, unknown>)[
            'correlationId'
          ],
        ).toBe('string');
        done();
      });
    });

    it('should set X-Correlation-Id response header', (done) => {
      const clientCorrelationId = 'resp-header-test-id';
      const request = createMockRequest({
        headers: { 'x-correlation-id': clientCorrelationId },
      });
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'x-correlation-id',
          clientCorrelationId,
        );
        done();
      });
    });
  });

  describe('structured logging with correlationId', () => {
    it('should log request with correlationId on success', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const request = createMockRequest({
        headers: { 'x-correlation-id': 'log-test-correlation-id' },
        method: 'POST',
        url: '/api/v1/context/switch',
      });
      (request as unknown as Record<string, unknown>)['user'] = {
        id: 'user-001',
        schoolId: 'school-001',
      };
      const response = createMockResponse();
      response.statusCode = 200;
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            requestId: 'log-test-correlation-id',
            userId: 'user-001',
            schoolId: 'school-001',
            method: 'POST',
            path: '/api/v1/context/switch',
            statusCode: 200,
          }),
        );
        done();
      });
    });

    it('should log request with correlationId on error', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const request = createMockRequest({
        headers: { 'x-correlation-id': 'error-corr-id' },
        method: 'POST',
        url: '/api/v1/context/switch',
      });
      const response = createMockResponse();
      response.statusCode = 403;
      const context = createMockExecutionContext(request, response);
      const errorHandler: CallHandler = {
        handle: () => throwError(() => new Error('Forbidden')),
      };

      interceptor.intercept(context, errorHandler).subscribe({
        error: () => {
          expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              requestId: 'error-corr-id',
            }),
          );
          done();
        },
      });
    });

    it('should log null userId and schoolId when user is not attached', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const request = createMockRequest({ headers: {} });
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: null,
            schoolId: null,
          }),
        );
        done();
      });
    });
  });

  describe('correlationId available for context operations', () => {
    it('should make correlationId available for ContextService to include in audit entries', (done) => {
      const correlationId = 'audit-trace-correlation-id';
      const request = createMockRequest({
        headers: { 'x-correlation-id': correlationId },
      });
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        // The correlationId is accessible on request for downstream services
        const attachedId = (request as unknown as Record<string, unknown>)[
          'correlationId'
        ];
        expect(attachedId).toBe(correlationId);
        // This is the value that gets passed to switchContext(user, schoolId, ip, correlationId)
        // and then included in audit log metadata and WorkspaceChangedEvent
        done();
      });
    });

    it('should make generated correlationId available for event propagation', (done) => {
      const request = createMockRequest({ headers: {} });
      const response = createMockResponse();
      const context = createMockExecutionContext(request, response);
      const callHandler = createMockCallHandler();

      interceptor.intercept(context, callHandler).subscribe(() => {
        const attachedId = (request as unknown as Record<string, unknown>)[
          'correlationId'
        ] as string;
        // A generated correlationId should be a valid UUID
        expect(attachedId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        // This correlationId propagates through WorkspaceChangedEvent to all consumers
        done();
      });
    });
  });
});
