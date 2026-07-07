import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerLimitDetail } from '@nestjs/throttler';
import { ContextThrottlerGuard } from './context-throttler.guard';
import { ContextSwitchRateLimitedException } from '../exceptions/context.exceptions';

describe('ContextThrottlerGuard', () => {
  let guard: ContextThrottlerGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 30 }]),
      ],
      providers: [ContextThrottlerGuard],
    }).compile();

    guard = module.get<ContextThrottlerGuard>(ContextThrottlerGuard);
  });

  describe('getTracker', () => {
    it('should return userId from JWT payload when user.id is available', async () => {
      const req = {
        user: { id: 'user-uuid-1234', email: 'test@nbk.edu.vn' },
        ip: '192.168.1.1',
      };

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('user-uuid-1234');
    });

    it('should return userId from user.userId when user.id is not available', async () => {
      const req = {
        user: { userId: 'user-uuid-5678' },
        ip: '10.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('user-uuid-5678');
    });

    it('should fallback to IP address when user is not present', async () => {
      const req = {
        ip: '172.16.0.1',
        connection: { remoteAddress: '172.16.0.1' },
      };

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('172.16.0.1');
    });

    it('should fallback to connection.remoteAddress when ip is not available', async () => {
      const req = {
        user: null,
        connection: { remoteAddress: '192.168.0.100' },
      };

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('192.168.0.100');
    });

    it('should return "unknown" when no user, ip, or connection info available', async () => {
      const req = {};

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('unknown');
    });

    it('should prioritize user.id over user.userId', async () => {
      const req = {
        user: { id: 'primary-id', userId: 'secondary-id' },
        ip: '10.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('primary-id');
    });
  });

  describe('throwThrottlingException', () => {
    it('should throw ContextSwitchRateLimitedException with HTTP 429', async () => {
      const mockContext = {} as ExecutionContext;
      const mockThrottlerLimitDetail = {} as ThrottlerLimitDetail;

      await expect(
        (guard as any).throwThrottlingException(mockContext, mockThrottlerLimitDetail),
      ).rejects.toThrow(ContextSwitchRateLimitedException);
    });

    it('should include Vietnamese message in the exception response', async () => {
      const mockContext = {} as ExecutionContext;
      const mockThrottlerLimitDetail = {} as ThrottlerLimitDetail;

      try {
        await (guard as any).throwThrottlingException(mockContext, mockThrottlerLimitDetail);
        fail('Should have thrown');
      } catch (err: unknown) {
        const error = err as ContextSwitchRateLimitedException;
        expect(error).toBeInstanceOf(ContextSwitchRateLimitedException);
        expect(error.getStatus()).toBe(429);
        const response = error.getResponse() as Record<string, unknown>;
        expect(response.message).toBe(
          'Quá nhiều yêu cầu chuyển đổi. Vui lòng thử lại sau.',
        );
        expect(response.errorCode).toBe('CONTEXT_SWITCH_RATE_LIMITED');
      }
    });

    it('should return success: false and data: null in exception response', async () => {
      const mockContext = {} as ExecutionContext;
      const mockThrottlerLimitDetail = {} as ThrottlerLimitDetail;

      try {
        await (guard as any).throwThrottlingException(mockContext, mockThrottlerLimitDetail);
        fail('Should have thrown');
      } catch (err: unknown) {
        const error = err as ContextSwitchRateLimitedException;
        const response = error.getResponse() as Record<string, unknown>;
        expect(response.success).toBe(false);
        expect(response.data).toBeNull();
      }
    });
  });

  describe('per-user rate limiting behavior', () => {
    it('should track different users independently', async () => {
      const reqUserA = {
        user: { id: 'user-A' },
        ip: '192.168.1.1',
      };
      const reqUserB = {
        user: { id: 'user-B' },
        ip: '192.168.1.1', // same IP, different user
      };

      const trackerA = await (guard as any).getTracker(reqUserA);
      const trackerB = await (guard as any).getTracker(reqUserB);

      // Different users should have different trackers even from same IP
      expect(trackerA).not.toBe(trackerB);
      expect(trackerA).toBe('user-A');
      expect(trackerB).toBe('user-B');
    });

    it('should return same tracker for same user from different IPs', async () => {
      const reqFromIp1 = {
        user: { id: 'user-X' },
        ip: '10.0.0.1',
      };
      const reqFromIp2 = {
        user: { id: 'user-X' },
        ip: '172.16.0.1',
      };

      const tracker1 = await (guard as any).getTracker(reqFromIp1);
      const tracker2 = await (guard as any).getTracker(reqFromIp2);

      // Same user from different IPs should have same tracker
      expect(tracker1).toBe(tracker2);
      expect(tracker1).toBe('user-X');
    });
  });
});
