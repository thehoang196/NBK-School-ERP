import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { ContextSwitchRateLimitedException } from '../exceptions/context.exceptions';

/**
 * Custom ThrottlerGuard for the context switch endpoint.
 *
 * Overrides the default IP-based tracking to use userId extracted from JWT,
 * enforcing per-user rate limiting (30 requests/minute/user).
 *
 * Returns HTTP 429 with Vietnamese message when rate limit is exceeded.
 *
 * Validates: Requirements 10.6
 */
@Injectable()
export class ContextThrottlerGuard extends ThrottlerGuard {
  /**
   * Extract userId from JWT payload for per-user rate limiting.
   * Falls back to IP address if user is not authenticated (should not happen
   * since JwtAuthGuard runs before this guard).
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;
    if (user && (user.id || user.userId)) {
      return user.id || user.userId;
    }
    // Fallback to IP if no user (shouldn't occur behind JwtAuthGuard)
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * Throw ContextSwitchRateLimitedException with Vietnamese message
   * instead of the default ThrottlerException.
   */
  protected async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new ContextSwitchRateLimitedException();
  }
}
