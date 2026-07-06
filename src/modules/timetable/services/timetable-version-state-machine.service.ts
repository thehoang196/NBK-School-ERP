import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import {
  ITimetableVersionStateMachine,
  TransitionMetadata,
} from '../interfaces/generation-pipeline.interface';
import { InvalidStateTransitionException } from '../exceptions/invalid-state-transition.exception';
import { PublishedVersionImmutableException } from '../exceptions/published-version-immutable.exception';

/**
 * State machine managing TimetableVersion lifecycle transitions.
 * Enforces valid transition paths, records metadata per transition,
 * and relies on TypeORM @VersionColumn() for optimistic locking.
 */
@Injectable()
export class TimetableVersionStateMachineService implements ITimetableVersionStateMachine {
  private readonly logger = new Logger(
    TimetableVersionStateMachineService.name,
  );

  /**
   * Valid state transitions map.
   * Key = current status, Value = array of allowed target statuses.
   */
  private static readonly VALID_TRANSITIONS = new Map<
    TimetableVersionStatus,
    TimetableVersionStatus[]
  >([
    [TimetableVersionStatus.DRAFT, [TimetableVersionStatus.GENERATING]],
    [
      TimetableVersionStatus.GENERATING,
      [TimetableVersionStatus.GENERATED, TimetableVersionStatus.FAILED],
    ],
    [TimetableVersionStatus.GENERATED, [TimetableVersionStatus.REVIEWING]],
    [
      TimetableVersionStatus.REVIEWING,
      [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.DRAFT],
    ],
    [TimetableVersionStatus.PUBLISHED, [TimetableVersionStatus.ARCHIVED]],
    [TimetableVersionStatus.FAILED, [TimetableVersionStatus.DRAFT]],
  ]);

  constructor(
    @InjectRepository(TimetableVersionEntity)
    private readonly repository: Repository<TimetableVersionEntity>,
  ) {}

  /**
   * Pure method — checks if a transition from currentStatus to targetStatus is valid.
   * No database access, no side effects.
   */
  canTransition(
    currentStatus: TimetableVersionStatus,
    targetStatus: TimetableVersionStatus,
  ): boolean {
    const allowedTargets =
      TimetableVersionStateMachineService.VALID_TRANSITIONS.get(currentStatus);
    if (!allowedTargets) {
      return false;
    }
    return allowedTargets.includes(targetStatus);
  }

  /**
   * Performs a state transition on the given version entity.
   * - Validates the transition against the state machine
   * - Applies metadata (timestamps, error info, publish info)
   * - Persists via repository.save() (optimistic locking via @VersionColumn)
   * - Wraps OptimisticLockVersionMismatchError into ConflictException (HTTP 409)
   */
  async transition(
    version: TimetableVersionEntity,
    targetStatus: TimetableVersionStatus,
    metadata?: TransitionMetadata,
  ): Promise<TimetableVersionEntity> {
    const currentStatus = version.status;

    // Guard: published versions cannot be mutated (only archived transition allowed)
    if (
      currentStatus === TimetableVersionStatus.PUBLISHED &&
      targetStatus !== TimetableVersionStatus.ARCHIVED
    ) {
      this.logger.warn(
        `Attempted mutation on published version ${version.id} → ${targetStatus}`,
      );
      throw new PublishedVersionImmutableException();
    }

    // Guard: validate transition
    if (!this.canTransition(currentStatus, targetStatus)) {
      this.logger.warn(
        `Invalid transition attempted: ${currentStatus} → ${targetStatus} for version ${version.id}`,
      );
      throw new InvalidStateTransitionException(currentStatus, targetStatus);
    }

    // Apply status change
    version.status = targetStatus;

    // Apply transition-specific metadata
    this.applyTransitionMetadata(version, targetStatus, metadata);

    this.logger.log(
      `Transitioning version ${version.id}: ${currentStatus} → ${targetStatus}`,
    );

    try {
      const saved = await this.repository.save(version);
      this.logger.log(
        `Version ${version.id} successfully transitioned to ${targetStatus}`,
      );
      return saved;
    } catch (error: unknown) {
      if (this.isOptimisticLockError(error)) {
        this.logger.error(
          `Optimistic lock conflict on version ${version.id} (version column mismatch)`,
        );
        throw new ConflictException(
          'Phiên bản TKB đã được cập nhật bởi người khác. Vui lòng tải lại và thử lại.',
        );
      }
      throw error;
    }
  }

  /**
   * Applies metadata fields based on the target status.
   */
  private applyTransitionMetadata(
    version: TimetableVersionEntity,
    targetStatus: TimetableVersionStatus,
    metadata?: TransitionMetadata,
  ): void {
    switch (targetStatus) {
      case TimetableVersionStatus.GENERATING:
        version.generationStartedAt = new Date();
        version.generationCompletedAt = null;
        version.generationDurationMs = null;
        version.errorMessage = null;
        version.errorStack = null;
        break;

      case TimetableVersionStatus.GENERATED:
        version.generationCompletedAt = new Date();
        if (version.generationStartedAt) {
          version.generationDurationMs =
            version.generationCompletedAt.getTime() -
            version.generationStartedAt.getTime();
        }
        if (metadata?.conflictCount !== undefined) {
          version.conflictCount = metadata.conflictCount;
          version.hasConflicts = metadata.conflictCount > 0;
        }
        break;

      case TimetableVersionStatus.FAILED:
        version.generationCompletedAt = new Date();
        if (version.generationStartedAt) {
          version.generationDurationMs =
            version.generationCompletedAt.getTime() -
            version.generationStartedAt.getTime();
        }
        if (metadata?.errorMessage) {
          version.errorMessage = metadata.errorMessage;
        }
        if (metadata?.errorStack) {
          version.errorStack = metadata.errorStack;
        }
        break;

      case TimetableVersionStatus.PUBLISHED:
        version.publishedAt = new Date();
        if (metadata?.userId) {
          version.publishedBy = metadata.userId;
        }
        break;

      case TimetableVersionStatus.DRAFT:
        // Reset generation-related fields when returning to draft
        version.errorMessage = null;
        version.errorStack = null;
        break;

      default:
        // No special metadata for REVIEWING or ARCHIVED
        break;
    }
  }

  /**
   * Checks if an error is a TypeORM OptimisticLockVersionMismatchError.
   */
  private isOptimisticLockError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'OptimisticLockVersionMismatchError';
    }
    return false;
  }
}
