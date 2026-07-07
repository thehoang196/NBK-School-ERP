import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';

/**
 * CacheModule — Cache abstraction cho NBK_EMS.
 *
 * Backend: Redis (ioredis) với fallback in-memory khi Redis không khả dụng.
 * Consumer sử dụng CacheService abstraction, không gọi Redis trực tiếp.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
