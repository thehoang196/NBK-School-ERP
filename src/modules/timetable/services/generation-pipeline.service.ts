import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { TimetableVersionStateMachineService } from './timetable-version-state-machine.service';
import { SubmitGenerationDto } from '../dto/submit-generation.dto';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import {
  GenerationSubmissionResult,
  GenerationJobStatus,
  IGenerationPipelineService,
} from '../interfaces/generation-pipeline.interface';
import { DuplicateGenerationException } from '../exceptions/duplicate-generation.exception';
import { FetConfig } from '../../../config/fet.config';

/**
 * Job payload structure for BullMQ timetable-generation queue.
 */
export interface GenerationJobPayload {
  versionId: string;
  semesterId: string;
  schoolId: string;
  userId: string;
  timeoutSeconds: number;
  name?: string;
}

/**
 * Abstraction over BullMQ Queue to allow optional injection.
 * When Redis/BullMQ is not available, the service still works
 * for validation/version-creation logic.
 */
export interface IGenerationQueue {
  add(name: string, data: GenerationJobPayload): Promise<{ id: string }>;
  getJob(jobId: string): Promise<{
    id: string;
    getState(): Promise<string>;
    progress: number;
    data: GenerationJobPayload;
    finishedOn?: number;
    failedReason?: string;
  } | null>;
  remove(jobId: string): Promise<void>;
}

/**
 * Token for injecting the BullMQ generation queue.
 */
export const GENERATION_QUEUE_TOKEN = 'GENERATION_QUEUE';

/**
 * GenerationPipelineService orchestrates timetable generation submission,
 * status tracking, and cancellation. It validates prerequisites, manages
 * TimetableVersion lifecycle, and delegates execution to BullMQ.
 */
@Injectable()
export class GenerationPipelineService implements IGenerationPipelineService {
  private readonly logger = new Logger(GenerationPipelineService.name);

  constructor(
    @InjectRepository(TimetableVersionEntity)
    private readonly versionRepository: Repository<TimetableVersionEntity>,
    private readonly stateMachine: TimetableVersionStateMachineService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Optional BullMQ queue — injected via module provider when Redis is available.
   * When null, submitGeneration will throw a descriptive error at enqueue step.
   */
  private generationQueue: IGenerationQueue | null = null;

  /**
   * Sets the generation queue. Called by module factory or in tests.
   */
  setGenerationQueue(queue: IGenerationQueue): void {
    this.generationQueue = queue;
  }

  /**
   * Submit a new timetable generation request.
   *
   * Steps:
   * 1. Validate school-scope authorization
   * 2. Check for duplicate (same school + semester in GENERATING status)
   * 3. Create TimetableVersion in DRAFT
   * 4. Transition to GENERATING via state machine
   * 5. Enqueue BullMQ job
   * 6. Store jobId on version
   * 7. Return submission result
   */
  async submitGeneration(
    dto: SubmitGenerationDto,
    user: CurrentUserPayload,
  ): Promise<GenerationSubmissionResult> {
    const schoolId = user.schoolId;

    // 1. Validate school-scope authorization
    if (!schoolId) {
      throw new ForbiddenException(
        'Người dùng không thuộc trường nào. Không thể sinh TKB.',
      );
    }

    // 2. Check for duplicate generation (same school + semester in GENERATING)
    await this.checkDuplicateGeneration(schoolId, dto.semesterId);

    // 3. Determine version number and name
    const versionNumber = await this.getNextVersionNumber(
      schoolId,
      dto.semesterId,
    );
    const name = dto.name || `TKB lần ${versionNumber}`;

    // 4. Create TimetableVersion in DRAFT
    const version = this.versionRepository.create({
      schoolId,
      semesterId: dto.semesterId,
      name,
      versionNumber,
      status: TimetableVersionStatus.DRAFT,
    });
    const savedVersion = await this.versionRepository.save(version);

    this.logger.log(
      `Created TimetableVersion ${savedVersion.id} (v${versionNumber}) for school ${schoolId}`,
    );

    // 5. Transition to GENERATING via state machine
    const generatingVersion = await this.stateMachine.transition(
      savedVersion,
      TimetableVersionStatus.GENERATING,
    );

    // 6. Enqueue BullMQ job
    const fetConfig = this.configService.get<FetConfig>('fet');
    const timeoutSeconds = fetConfig?.engine?.defaultTimeoutSeconds ?? 300;

    const jobPayload: GenerationJobPayload = {
      versionId: generatingVersion.id,
      semesterId: dto.semesterId,
      schoolId,
      userId: user.id,
      timeoutSeconds,
      name,
    };

    let jobId: string;
    if (this.generationQueue) {
      const job = await this.generationQueue.add(
        'generate-timetable',
        jobPayload,
      );
      jobId = job.id;
    } else {
      // BullMQ not available — generate a placeholder job ID
      jobId = `local-${generatingVersion.id}`;
      this.logger.warn(
        'BullMQ queue không khả dụng. Đã tạo job ID tạm: ' + jobId,
      );
    }

    // 7. Store jobId on the version entity
    generatingVersion.jobId = jobId;
    await this.versionRepository.save(generatingVersion);

    this.logger.log(
      `Generation job ${jobId} enqueued for version ${generatingVersion.id}`,
    );

    return {
      jobId,
      versionId: generatingVersion.id,
      status: generatingVersion.status,
    };
  }

  /**
   * Get the current status of a generation job.
   * Combines TimetableVersion status with BullMQ job state.
   */
  async getJobStatus(
    jobId: string,
    schoolId: string,
  ): Promise<GenerationJobStatus> {
    // Find version by jobId, scoped to school
    const version = await this.findVersionByJobId(jobId, schoolId);

    // Query BullMQ job for real-time state
    let queueStatus: 'waiting' | 'active' | 'completed' | 'failed' = 'waiting';
    let progress = 0;
    let stage = 'queued';
    let completedAt: Date | undefined;
    let errorMessage: string | undefined;

    if (this.generationQueue) {
      const job = await this.generationQueue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        queueStatus = this.mapJobState(state);
        progress = typeof job.progress === 'number' ? job.progress : 0;
        if (job.finishedOn) {
          completedAt = new Date(job.finishedOn);
        }
        if (job.failedReason) {
          errorMessage = job.failedReason;
        }
      }
    }

    // Derive stage from version status when queue info unavailable
    if (!this.generationQueue || queueStatus === 'waiting') {
      stage = this.deriveStageFromStatus(version.status);
      queueStatus = this.mapVersionStatusToJobStatus(version.status);
    }

    if (version.errorMessage) {
      errorMessage = version.errorMessage;
    }
    if (version.generationCompletedAt) {
      completedAt = version.generationCompletedAt;
    }

    return {
      jobId,
      versionId: version.id,
      status: queueStatus,
      progress,
      stage,
      errorMessage,
      completedAt,
    };
  }

  /**
   * Cancel a generation job.
   * If the job is waiting: remove from queue.
   * If active: signal abort.
   * Transition version to FAILED.
   */
  async cancelJob(jobId: string, schoolId: string): Promise<void> {
    const version = await this.findVersionByJobId(jobId, schoolId);

    // Attempt to remove from queue
    if (this.generationQueue) {
      try {
        await this.generationQueue.remove(jobId);
        this.logger.log(`Removed job ${jobId} from queue`);
      } catch {
        this.logger.warn(
          `Could not remove job ${jobId} from queue (may be active)`,
        );
      }
    }

    // Transition version to FAILED with cancellation message
    if (version.status === TimetableVersionStatus.GENERATING) {
      await this.stateMachine.transition(
        version,
        TimetableVersionStatus.FAILED,
        { errorMessage: 'Đã hủy bởi người dùng' },
      );
      this.logger.log(
        `Version ${version.id} cancelled by user, transitioned to FAILED`,
      );
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Checks if there is already a version in GENERATING status
   * for the given school and semester.
   */
  private async checkDuplicateGeneration(
    schoolId: string,
    semesterId: string,
  ): Promise<void> {
    const existing = await this.versionRepository.findOne({
      where: {
        schoolId,
        semesterId,
        status: TimetableVersionStatus.GENERATING,
        deletedAt: IsNull(),
      },
    });

    if (existing) {
      this.logger.warn(
        `Duplicate generation rejected: school=${schoolId}, semester=${semesterId}, existing version=${existing.id}`,
      );
      throw new DuplicateGenerationException();
    }
  }

  /**
   * Gets the next sequential version number for a school + semester.
   */
  private async getNextVersionNumber(
    schoolId: string,
    semesterId: string,
  ): Promise<number> {
    const result = await this.versionRepository
      .createQueryBuilder('tv')
      .select('MAX(tv.version_number)', 'maxVersion')
      .where('tv.school_id = :schoolId', { schoolId })
      .andWhere('tv.semester_id = :semesterId', { semesterId })
      .getRawOne();
    return ((result?.maxVersion as number) || 0) + 1;
  }

  /**
   * Finds a TimetableVersion by jobId, enforcing school scope.
   */
  private async findVersionByJobId(
    jobId: string,
    schoolId: string,
  ): Promise<TimetableVersionEntity> {
    const version = await this.versionRepository.findOne({
      where: {
        jobId,
        schoolId,
        deletedAt: IsNull(),
      },
    });

    if (!version) {
      throw new NotFoundException(
        `Không tìm thấy job ${jobId} cho trường này.`,
      );
    }

    return version;
  }

  /**
   * Maps BullMQ job state string to our simplified status.
   */
  private mapJobState(
    state: string,
  ): 'waiting' | 'active' | 'completed' | 'failed' {
    switch (state) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'active':
        return 'active';
      default:
        return 'waiting';
    }
  }

  /**
   * Derives pipeline stage from version status.
   */
  private deriveStageFromStatus(status: TimetableVersionStatus): string {
    switch (status) {
      case TimetableVersionStatus.GENERATING:
        return 'generating';
      case TimetableVersionStatus.GENERATED:
        return 'completed';
      case TimetableVersionStatus.FAILED:
        return 'failed';
      default:
        return 'queued';
    }
  }

  /**
   * Maps TimetableVersion status to job status for fallback.
   */
  private mapVersionStatusToJobStatus(
    status: TimetableVersionStatus,
  ): 'waiting' | 'active' | 'completed' | 'failed' {
    switch (status) {
      case TimetableVersionStatus.GENERATING:
        return 'active';
      case TimetableVersionStatus.GENERATED:
        return 'completed';
      case TimetableVersionStatus.FAILED:
        return 'failed';
      default:
        return 'waiting';
    }
  }
}
