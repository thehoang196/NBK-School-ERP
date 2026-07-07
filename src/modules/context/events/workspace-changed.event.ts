/**
 * Event emitted after a successful workspace context switch.
 * Published AFTER the Redis session update is confirmed successful.
 *
 * Consumers:
 * - Cache invalidation: clear user-specific cached data for previous school
 * - Notification: realtime update via WebSocket if needed
 * - Analytics: track workspace switch behavior patterns
 * - Audit: log context change with full traceability
 * - Realtime: push UI update to frontend via WebSocket
 *
 * Validates: Requirements 14.1, 14.3
 */
export class WorkspaceChangedEvent {
  public static readonly eventName = 'workspace.changed';

  constructor(
    /** The user who switched workspace */
    public readonly userId: string,
    /** The school they were in before (null if first switch) */
    public readonly previousSchoolId: string | null,
    /** The school they switched to */
    public readonly newSchoolId: string,
    /** Timestamp of the switch */
    public readonly switchedAt: Date,
    /** Correlation ID for tracing across systems */
    public readonly correlationId: string,
  ) {}
}
