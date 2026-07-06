import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * CacheModule — Cache abstraction cho NBK_EMS.
 *
 * Hiện tại dùng in-memory cache (Map) làm fallback khi Redis chưa sẵn sàng.
 * Khi Redis available, chuyển sang Redis client trong CacheService mà
 * không thay đổi interface cho consumer.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
