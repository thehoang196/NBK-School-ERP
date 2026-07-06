import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantRlsService } from './tenant-rls.service';
import { TenantSubscriber } from './tenant.subscriber';
import { SchoolEntity } from '../../modules/school/entities/school.entity';

/**
 * Global module that provides tenant context services throughout the application.
 * Being @Global() means TenantContextService and other tenant providers
 * are available in all modules without explicit imports.
 *
 * The TenantMiddleware is applied to all routes and initializes the
 * tenant context (AsyncLocalStorage) for the duration of each request.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SchoolEntity])],
  providers: [
    TenantContextService,
    TenantAuditService,
    TenantMiddleware,
    TenantRlsService,
    TenantSubscriber,
  ],
  exports: [
    TenantContextService,
    TenantAuditService,
    TenantMiddleware,
    TenantRlsService,
    TenantSubscriber,
  ],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
