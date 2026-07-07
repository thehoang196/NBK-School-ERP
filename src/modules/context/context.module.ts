import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { SchoolModule } from '../school/school.module';
import { TeacherSchoolAssignmentModule } from '../teacher-school-assignment/teacher-school-assignment.module';
import { AuditModule } from '../audit/audit.module';
import { SchoolEntity } from '../school/entities/school.entity';
import { ContextSessionService } from './services/context-session.service';
import { ContextService } from './services/context.service';
import { ContextFeatureFlagService } from './services/context-feature-flag.service';
import { AccessibleSchoolsCacheService } from './services/accessible-schools-cache.service';
import { PermissionCacheService } from './services/permission-cache.service';
import { ContextController } from './controllers/context.controller';
import { ContextMetricsService } from './services/context-metrics.service';
import { ContextThrottlerGuard } from './guards/context-throttler.guard';
import {
  WorkspaceChangedCacheSubscriber,
  WorkspaceChangedAuditSubscriber,
  WorkspaceChangedAnalyticsSubscriber,
  WorkspaceChangedRealtimeSubscriber,
} from './events/workspace-changed.subscriber';

/**
 * ContextModule — Workspace Context Switcher cho NBK_EMS.
 *
 * Quản lý workspace context (trường học đang hoạt động) cho người dùng,
 * hỗ trợ chuyển đổi trường không cần re-login, session Redis-backed,
 * và tính toán danh sách trường có quyền truy cập theo vai trò.
 */
@Module({
  imports: [
    CacheModule,
    SchoolModule,
    TeacherSchoolAssignmentModule,
    AuditModule,
    TypeOrmModule.forFeature([SchoolEntity]),
  ],
  controllers: [ContextController],
  providers: [
    ContextSessionService,
    ContextService,
    ContextFeatureFlagService,
    AccessibleSchoolsCacheService,
    PermissionCacheService,
    ContextThrottlerGuard,
    ContextMetricsService,
    // Event subscribers for WorkspaceChangedEvent
    WorkspaceChangedCacheSubscriber,
    WorkspaceChangedAuditSubscriber,
    WorkspaceChangedAnalyticsSubscriber,
    WorkspaceChangedRealtimeSubscriber,
  ],
  exports: [ContextSessionService, ContextService, ContextFeatureFlagService, AccessibleSchoolsCacheService, PermissionCacheService, ContextMetricsService],
})
export class ContextModule {}
