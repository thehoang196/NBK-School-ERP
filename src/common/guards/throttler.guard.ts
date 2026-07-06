import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard cho NBK_EMS.
 *
 * Mở rộng ThrottlerGuard mặc định:
 * - Bỏ qua rate limit cho internal health check
 * - Có thể override getTracker để dùng userId thay vì IP (tương lai)
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path: string = request.url || request.path || '';

    // Health check không cần rate limit
    if (path.includes('/health')) {
      return true;
    }

    return false;
  }
}
