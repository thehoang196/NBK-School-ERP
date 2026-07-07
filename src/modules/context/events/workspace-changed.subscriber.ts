import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from '../../cache/cache.service';
import { AccessibleSchoolsCacheService } from '../services/accessible-schools-cache.service';
import { WorkspaceChangedEvent } from './workspace-changed.event';

/**
 * Cache Subscriber — Invalidates user-specific cached data when workspace changes.
 *
 * Clears:
 * - accessible-schools:{userId} — via AccessibleSchoolsCacheService.invalidateForUser()
 * - Previous school-specific cached data for the user
 *
 * Wrapped in try-catch: listener failure MUST NOT rollback the switch.
 *
 * Validates: Requirements 14.2, 14.4
 */
@Injectable()
export class WorkspaceChangedCacheSubscriber {
  private readonly logger = new Logger(WorkspaceChangedCacheSubscriber.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly accessibleSchoolsCacheService: AccessibleSchoolsCacheService,
  ) {}

  @OnEvent(WorkspaceChangedEvent.eventName)
  async handleCacheInvalidation(event: WorkspaceChangedEvent): Promise<void> {
    try {
      // Clear user's accessible schools cache via dedicated service
      await this.accessibleSchoolsCacheService.invalidateForUser(event.userId);

      // Clear previous school-specific data for this user (if applicable)
      if (event.previousSchoolId) {
        await this.cacheService.del(
          `context:user-school:${event.userId}:${event.previousSchoolId}`,
        );
      }

      this.logger.log(
        `Cache invalidated for user ${event.userId} after workspace switch`,
        {
          userId: event.userId,
          previousSchoolId: event.previousSchoolId,
          newSchoolId: event.newSchoolId,
          correlationId: event.correlationId,
        },
      );
    } catch (error) {
      this.logger.error(
        `Cache invalidation failed for user ${event.userId} — not rolling back switch`,
        {
          userId: event.userId,
          correlationId: event.correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Do NOT throw — consumer failure must not affect the switch
    }
  }
}

/**
 * Audit Subscriber — Logs context change with correlationId.
 *
 * This is a lightweight audit log via Logger (structured logging).
 * The synchronous AuditLogService is already called in switchContext,
 * so this subscriber provides additional async traceability via correlationId.
 *
 * Wrapped in try-catch: listener failure MUST NOT rollback the switch.
 *
 * Validates: Requirements 14.2, 14.4
 */
@Injectable()
export class WorkspaceChangedAuditSubscriber {
  private readonly logger = new Logger(WorkspaceChangedAuditSubscriber.name);

  @OnEvent(WorkspaceChangedEvent.eventName)
  async handleAuditLog(event: WorkspaceChangedEvent): Promise<void> {
    try {
      this.logger.log('Workspace context changed', {
        userId: event.userId,
        previousSchoolId: event.previousSchoolId,
        newSchoolId: event.newSchoolId,
        switchedAt: event.switchedAt.toISOString(),
        correlationId: event.correlationId,
        eventName: WorkspaceChangedEvent.eventName,
      });
    } catch (error) {
      this.logger.error(
        `Audit logging failed for workspace change — not rolling back switch`,
        {
          userId: event.userId,
          correlationId: event.correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Do NOT throw — consumer failure must not affect the switch
    }
  }
}

/**
 * Analytics Subscriber (P2 — Stub) — Tracks workspace switch patterns.
 *
 * Future implementation: persist switch frequency, time-of-day patterns,
 * and cross-school navigation graphs for analytics dashboards.
 *
 * Wrapped in try-catch: listener failure MUST NOT rollback the switch.
 *
 * Validates: Requirements 14.2, 14.4
 */
@Injectable()
export class WorkspaceChangedAnalyticsSubscriber {
  private readonly logger = new Logger(
    WorkspaceChangedAnalyticsSubscriber.name,
  );

  @OnEvent(WorkspaceChangedEvent.eventName)
  async handleAnalyticsTracking(event: WorkspaceChangedEvent): Promise<void> {
    try {
      // P2: Future implementation — track switch patterns, frequency, timing
      this.logger.debug('Analytics: workspace switch tracked (stub)', {
        userId: event.userId,
        previousSchoolId: event.previousSchoolId,
        newSchoolId: event.newSchoolId,
        switchedAt: event.switchedAt.toISOString(),
        correlationId: event.correlationId,
      });
    } catch (error) {
      this.logger.error(
        `Analytics tracking failed for workspace change — not rolling back switch`,
        {
          userId: event.userId,
          correlationId: event.correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Do NOT throw — consumer failure must not affect the switch
    }
  }
}

/**
 * Realtime Subscriber (P2 — Stub) — Pushes WebSocket update to frontend.
 *
 * Future implementation: notify the user's connected WebSocket clients
 * that the workspace has changed, so the frontend can refresh UI state.
 *
 * Wrapped in try-catch: listener failure MUST NOT rollback the switch.
 *
 * Validates: Requirements 14.2, 14.4
 */
@Injectable()
export class WorkspaceChangedRealtimeSubscriber {
  private readonly logger = new Logger(
    WorkspaceChangedRealtimeSubscriber.name,
  );

  @OnEvent(WorkspaceChangedEvent.eventName)
  async handleRealtimeUpdate(event: WorkspaceChangedEvent): Promise<void> {
    try {
      // P2: Future implementation — push WebSocket update to frontend
      this.logger.debug(
        'Realtime: workspace change notification (stub — WebSocket not yet implemented)',
        {
          userId: event.userId,
          newSchoolId: event.newSchoolId,
          correlationId: event.correlationId,
        },
      );
    } catch (error) {
      this.logger.error(
        `Realtime notification failed for workspace change — not rolling back switch`,
        {
          userId: event.userId,
          correlationId: event.correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Do NOT throw — consumer failure must not affect the switch
    }
  }
}
