import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Observable, Subject, filter, takeWhile } from 'rxjs';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import {
  IProgressGateway,
  ProgressEvent,
} from '../interfaces/generation-pipeline.interface';

/**
 * GenerationProgressGatewayService bridges pipeline progress events to SSE streams.
 *
 * Uses an in-memory Subject-per-version approach:
 * - The processor calls `emitProgress()` during pipeline execution
 * - Connected clients subscribe via `streamProgress()` which returns an Observable
 * - On connection, the current state is immediately emitted
 * - Subjects auto-complete when a terminal status is reached
 *
 * Multi-tenant: verifies schoolId matches before allowing stream access.
 */
@Injectable()
export class GenerationProgressGatewayService implements IProgressGateway {
  private readonly logger = new Logger(GenerationProgressGatewayService.name);

  /**
   * Map of versionId → Subject for active progress streams.
   * Cleaned up when generation finishes or fails.
   */
  private readonly subjects = new Map<string, Subject<ProgressEvent>>();

  /**
   * Map of versionId → last emitted ProgressEvent for immediate replay on connect.
   */
  private readonly lastEvents = new Map<string, ProgressEvent>();

  constructor(
    @InjectRepository(TimetableVersionEntity)
    private readonly versionRepository: Repository<TimetableVersionEntity>,
  ) {}

  /**
   * Stream progress events for a specific version via SSE.
   *
   * 1. Verifies the version belongs to the given schoolId (multi-tenant)
   * 2. Immediately emits the current state on connection
   * 3. Subscribes to ongoing progress events
   * 4. Auto-completes when generation reaches GENERATED or FAILED
   *
   * @param versionId - The TimetableVersion to monitor
   * @param schoolId - The caller's schoolId for tenant verification
   * @returns Observable<ProgressEvent> suitable for NestJS @Sse() decorator
   */
  streamProgress(
    versionId: string,
    schoolId: string,
  ): Observable<ProgressEvent> {
    return new Observable<ProgressEvent>((subscriber) => {
      this.initStream(versionId, schoolId)
        .then((initialEvent) => {
          // Emit the initial/current state immediately
          subscriber.next(initialEvent);

          // Get or create subject for this version
          const subject = this.getOrCreateSubject(versionId);

          // Subscribe to future events, filtering by versionId
          const subscription = subject
            .pipe(
              filter((event) => event.versionId === versionId),
              takeWhile((event) => !this.isTerminalEvent(event), true),
            )
            .subscribe({
              next: (event) => subscriber.next(event),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });

          // Cleanup on unsubscribe
          subscriber.add(() => {
            subscription.unsubscribe();
          });
        })
        .catch((err) => {
          subscriber.error(err);
        });
    });
  }

  /**
   * Emit a progress event for a version.
   * Called by the GenerationJobProcessor during pipeline execution.
   *
   * @param versionId - The version being processed
   * @param event - The progress event to emit
   */
  emitProgress(versionId: string, event: ProgressEvent): void {
    this.logger.debug(
      `Phát sự kiện tiến trình: version=${versionId}, stage=${event.stage}, progress=${event.progress}%`,
    );

    // Store as last known event for replay
    this.lastEvents.set(versionId, event);

    // Emit to subscribers
    const subject = this.subjects.get(versionId);
    if (subject) {
      subject.next(event);

      // If terminal, complete the subject and clean up
      if (this.isTerminalEvent(event)) {
        this.completeAndCleanup(versionId);
      }
    }
  }

  /**
   * Complete the subject for a version (called when generation finishes).
   * Notifies all subscribers that the stream is done.
   *
   * @param versionId - The version whose stream should complete
   */
  completeVersion(versionId: string): void {
    this.completeAndCleanup(versionId);
  }

  /**
   * Get the last known progress for a version (for late-connecting clients).
   */
  getLatestProgress(versionId: string): ProgressEvent | null {
    return this.lastEvents.get(versionId) ?? null;
  }

  /**
   * Get the count of active subjects (for monitoring/testing).
   */
  getActiveStreamCount(): number {
    return this.subjects.size;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Initialize stream by verifying tenant access and building initial event.
   */
  private async initStream(
    versionId: string,
    schoolId: string,
  ): Promise<ProgressEvent> {
    // Verify the version exists and belongs to the school
    const version = await this.versionRepository.findOne({
      where: { id: versionId, deletedAt: IsNull() },
    });

    if (!version) {
      throw new NotFoundException(`Không tìm thấy phiên bản TKB: ${versionId}`);
    }

    if (version.schoolId !== schoolId) {
      throw new ForbiddenException(
        'Không có quyền truy cập tiến trình sinh TKB của trường khác.',
      );
    }

    // Check if we have a cached last event
    const lastEvent = this.lastEvents.get(versionId);
    if (lastEvent) {
      return lastEvent;
    }

    // Build initial event from current version status
    return this.buildInitialEvent(version);
  }

  /**
   * Build a ProgressEvent from the current TimetableVersion state.
   */
  private buildInitialEvent(version: TimetableVersionEntity): ProgressEvent {
    const stageMap: Record<
      TimetableVersionStatus,
      { stage: string; progress: number; message: string }
    > = {
      [TimetableVersionStatus.DRAFT]: {
        stage: 'queued',
        progress: 0,
        message: 'Đang chờ xử lý',
      },
      [TimetableVersionStatus.GENERATING]: {
        stage: 'generating',
        progress: 5,
        message: 'Đang sinh thời khóa biểu...',
      },
      [TimetableVersionStatus.GENERATED]: {
        stage: 'completed',
        progress: 100,
        message: 'Hoàn thành sinh TKB',
      },
      [TimetableVersionStatus.FAILED]: {
        stage: 'failed',
        progress: 0,
        message: version.errorMessage || 'Sinh TKB thất bại',
      },
      [TimetableVersionStatus.REVIEWING]: {
        stage: 'completed',
        progress: 100,
        message: 'Đang xem xét',
      },
      [TimetableVersionStatus.PUBLISHED]: {
        stage: 'completed',
        progress: 100,
        message: 'Đã công bố',
      },
      [TimetableVersionStatus.ARCHIVED]: {
        stage: 'completed',
        progress: 100,
        message: 'Đã lưu trữ',
      },
    };

    const info = stageMap[version.status];

    return {
      versionId: version.id,
      stage: info.stage,
      progress: info.progress,
      message: info.message,
      timestamp: new Date(),
    };
  }

  /**
   * Get or create a Subject for a version.
   */
  private getOrCreateSubject(versionId: string): Subject<ProgressEvent> {
    let subject = this.subjects.get(versionId);
    if (!subject) {
      subject = new Subject<ProgressEvent>();
      this.subjects.set(versionId, subject);
      this.logger.debug(`Tạo subject mới cho version: ${versionId}`);
    }
    return subject;
  }

  /**
   * Check if a progress event represents a terminal state.
   */
  private isTerminalEvent(event: ProgressEvent): boolean {
    return event.stage === 'completed' || event.stage === 'failed';
  }

  /**
   * Complete the subject and clean up resources.
   */
  private completeAndCleanup(versionId: string): void {
    const subject = this.subjects.get(versionId);
    if (subject) {
      subject.complete();
      this.subjects.delete(versionId);
      this.logger.debug(`Đã dọn dẹp subject cho version: ${versionId}`);
    }
    // Keep lastEvents for a while in case late-connecting clients need it
    // Cleanup after 5 minutes
    setTimeout(
      () => {
        this.lastEvents.delete(versionId);
      },
      5 * 60 * 1000,
    );
  }
}
