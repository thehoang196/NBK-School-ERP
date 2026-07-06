import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { TimetableVersionStateMachineService } from '../services/timetable-version-state-machine.service';
import { FetInputDataCollectorService } from '../services/fet-input-data-collector.service';
import { FetInputExporterService } from '../services/fet-input-exporter.service';
import { FetEngineAdapterService } from '../services/fet-engine-adapter.service';
import { FetOutputParserService } from '../services/fet-output-parser.service';
import { ResultMapperService } from '../services/result-mapper.service';
import { ConflictDetectionService } from '../services/conflict-detection.service';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import {
  FetParseContext,
  FetInputData,
  FetExportResult,
  ParsedSlotDto,
} from '../interfaces/fet-dto.interface';
import { GenerationJobPayload } from '../services/generation-pipeline.service';

/**
 * Pipeline stages enum for structured logging and progress tracking.
 */
export enum PipelineStage {
  INPUT_EXPORT = 'input_export',
  FET_RUNNING = 'fet_running',
  OUTPUT_PARSING = 'output_parsing',
  RESULT_MAPPING = 'result_mapping',
  CONFLICT_DETECTION = 'conflict_detection',
}

/**
 * Result returned by the processor on successful pipeline completion.
 */
export interface GenerationJobResult {
  versionId: string;
  slotCount: number;
  conflictCount: number;
  durationMs: number;
  hasWarnings: boolean;
}

/**
 * BullMQ processor orchestrating the FET Generation Pipeline.
 *
 * Pipeline stages executed sequentially:
 * 1. input_export (0–10%): Collect domain data, validate, export to FET XML
 * 2. fet_running (10–80%): Invoke FET engine via Docker container
 * 3. output_parsing (80–85%): Parse and validate FET output XML
 * 4. result_mapping (85–95%): Persist timetable slots in a transaction
 * 5. conflict_detection (95–100%): Detect post-generation conflicts
 *
 * Error handling at each stage:
 * - input_export: Transition to FAILED, no cleanup needed
 * - fet_running: Container killed by adapter, transition to FAILED
 * - output_parsing: Log raw XML, transition to FAILED
 * - result_mapping: Transaction auto-rollback, transition to FAILED
 * - conflict_detection: Slots committed → delete slots on failure, transition to FAILED
 */
@Processor('timetable-generation')
export class TimetableGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(TimetableGenerationProcessor.name);

  constructor(
    private readonly fetInputDataCollector: FetInputDataCollectorService,
    private readonly fetInputExporter: FetInputExporterService,
    private readonly fetEngineAdapter: FetEngineAdapterService,
    private readonly fetOutputParser: FetOutputParserService,
    private readonly resultMapper: ResultMapperService,
    private readonly conflictDetection: ConflictDetectionService,
    private readonly stateMachine: TimetableVersionStateMachineService,
    @InjectRepository(TimetableVersionEntity)
    private readonly versionRepository: Repository<TimetableVersionEntity>,
    private readonly slotRepository: TimetableSlotRepository,
  ) {
    super();
  }

  /**
   * Main processor entry point — orchestrates the complete pipeline.
   */
  async process(job: Job<GenerationJobPayload>): Promise<GenerationJobResult> {
    const { versionId, semesterId, schoolId, timeoutSeconds } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `[Job ${job.id}] Bắt đầu pipeline sinh TKB — version: ${versionId}, semester: ${semesterId}, school: ${schoolId}`,
    );

    // Load the version entity
    const version = await this.loadVersion(versionId);

    try {
      // ─── Stage 1: INPUT_EXPORT (0–10%) ───────────────────────────────────
      const { inputData, exportResult } = await this.executeInputExport(
        job,
        version,
        semesterId,
        schoolId,
      );

      // ─── Stage 2: FET_RUNNING (10–80%) ──────────────────────────────────
      const outputXml = await this.executeFetRunning(
        job,
        version,
        exportResult.xml,
        timeoutSeconds,
      );

      // ─── Stage 3: OUTPUT_PARSING (80–85%) ────────────────────────────────
      const parseResult = await this.executeOutputParsing(
        job,
        version,
        outputXml,
        exportResult,
        inputData,
      );

      // ─── Stage 4: RESULT_MAPPING (85–95%) ────────────────────────────────
      const slotCount = await this.executeResultMapping(
        job,
        version,
        parseResult.slots,
        versionId,
        schoolId,
      );

      // ─── Stage 5: CONFLICT_DETECTION (95–100%) ──────────────────────────
      const conflictCount = await this.executeConflictDetection(
        job,
        version,
        versionId,
        schoolId,
        slotCount,
      );

      // ─── Pipeline Success ────────────────────────────────────────────────
      const durationMs = Date.now() - startTime;
      const hasWarnings = conflictCount > 0;

      this.logger.log(
        `[Job ${job.id}] Pipeline hoàn thành — ${slotCount} slots, ${conflictCount} xung đột, ${durationMs}ms`,
      );

      return {
        versionId,
        slotCount,
        conflictCount,
        durationMs,
        hasWarnings,
      };
    } catch (error: unknown) {
      // All stage-level handlers should have already handled the transition.
      // This catch is a safety net for truly unexpected errors.
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[Job ${job.id}] Pipeline thất bại (unhandled): ${errorMessage}`,
        errorStack,
      );

      // Attempt to transition to FAILED if not already
      await this.safeTransitionToFailed(version, errorMessage, errorStack);

      throw error;
    }
  }

  // ─── Stage Implementations ─────────────────────────────────────────────────

  /**
   * Stage 1: INPUT_EXPORT — Collect domain data, validate, export to FET XML.
   * Progress: 0% → 10%
   * On failure: Transition to FAILED, no cleanup needed.
   */
  private async executeInputExport(
    job: Job<GenerationJobPayload>,
    version: TimetableVersionEntity,
    semesterId: string,
    schoolId: string,
  ): Promise<{ inputData: FetInputData; exportResult: FetExportResult }> {
    this.logger.log(
      `[Job ${job.id}] Stage: ${PipelineStage.INPUT_EXPORT} — Thu thập và xuất dữ liệu FET`,
    );

    try {
      // Collect domain data
      const inputData = await this.fetInputDataCollector.collectForGeneration(
        semesterId,
        schoolId,
      );

      // Validate input
      const validation = this.fetInputExporter.validate(inputData);
      if (!validation.valid) {
        const fields = validation.errors
          .map((e) => `${e.field}: ${e.message}`)
          .join('; ');
        throw new Error(`Dữ liệu đầu vào không hợp lệ: ${fields}`);
      }

      // Export to XML
      const exportResult = this.fetInputExporter.export(inputData);

      await job.updateProgress(10);
      this.logger.log(
        `[Job ${job.id}] Stage ${PipelineStage.INPUT_EXPORT} hoàn thành — ${inputData.teachingAssignments.length} phân công, ${exportResult.activityMap.size} hoạt động`,
      );

      return { inputData, exportResult };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[Job ${job.id}] Stage ${PipelineStage.INPUT_EXPORT} thất bại: ${errorMessage}`,
      );

      await this.safeTransitionToFailed(version, errorMessage, errorStack);
      throw error;
    }
  }

  /**
   * Stage 2: FET_RUNNING — Invoke FET engine via Docker container.
   * Progress: 10% → 80%
   * On failure: Container killed by adapter, transition to FAILED.
   */
  private async executeFetRunning(
    job: Job<GenerationJobPayload>,
    version: TimetableVersionEntity,
    inputXml: string,
    timeoutSeconds: number,
  ): Promise<string> {
    this.logger.log(
      `[Job ${job.id}] Stage: ${PipelineStage.FET_RUNNING} — Khởi chạy FET engine (timeout: ${timeoutSeconds}s)`,
    );

    try {
      const solveResult = await this.fetEngineAdapter.solve({
        inputXml,
        timeoutSeconds,
        jobId: String(job.id),
      });

      await job.updateProgress(80);

      if (!solveResult.success && !solveResult.outputXml) {
        const message = solveResult.timedOut
          ? `FET engine vượt quá thời gian cho phép (${timeoutSeconds}s)`
          : `FET engine thất bại (exit code: ${solveResult.exitCode}): ${solveResult.stderr}`;

        throw new Error(message);
      }

      // If we have a partial result from timeout, use it
      if (solveResult.partialResult && solveResult.outputXml) {
        this.logger.warn(
          `[Job ${job.id}] FET trả về kết quả partial (best-effort) do timeout`,
        );
      }

      if (!solveResult.outputXml) {
        throw new Error('FET engine không tạo được file kết quả');
      }

      this.logger.log(
        `[Job ${job.id}] Stage ${PipelineStage.FET_RUNNING} hoàn thành — ${solveResult.durationMs}ms`,
      );

      return solveResult.outputXml;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[Job ${job.id}] Stage ${PipelineStage.FET_RUNNING} thất bại: ${errorMessage}`,
      );

      await this.safeTransitionToFailed(version, errorMessage, errorStack);
      throw error;
    }
  }

  /**
   * Stage 3: OUTPUT_PARSING — Parse and validate FET output XML.
   * Progress: 80% → 85%
   * On failure: Log raw XML, transition to FAILED.
   */
  private async executeOutputParsing(
    job: Job<GenerationJobPayload>,
    version: TimetableVersionEntity,
    outputXml: string,
    exportResult: FetExportResult,
    inputData: FetInputData,
  ): Promise<{ slots: ParsedSlotDto[]; warnings: string[] }> {
    this.logger.log(
      `[Job ${job.id}] Stage: ${PipelineStage.OUTPUT_PARSING} — Phân tích kết quả FET`,
    );

    try {
      // Build parse context from export result and input data
      const context = this.buildParseContext(exportResult, inputData);

      // Parse FET output
      const parseResult = this.fetOutputParser.parse(outputXml, context);

      if (!parseResult.success) {
        const errorDetails = parseResult.errors
          .map((e) => `Activity ${e.activityId}: ${e.field} — ${e.message}`)
          .join('; ');

        this.logger.error(
          `[Job ${job.id}] Lỗi phân tích kết quả FET: ${errorDetails}`,
        );
        this.logger.debug(
          `[Job ${job.id}] Raw FET output XML:\n${outputXml.substring(0, 2000)}...`,
        );

        throw new Error(`Lỗi phân tích kết quả FET: ${errorDetails}`);
      }

      await job.updateProgress(85);
      this.logger.log(
        `[Job ${job.id}] Stage ${PipelineStage.OUTPUT_PARSING} hoàn thành — ${parseResult.slots.length} slots phân tích thành công`,
      );

      return { slots: parseResult.slots, warnings: parseResult.warnings };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log raw XML for debugging on parse failure
      this.logger.debug(
        `[Job ${job.id}] Raw FET output XML (failure):\n${outputXml.substring(0, 5000)}`,
      );

      this.logger.error(
        `[Job ${job.id}] Stage ${PipelineStage.OUTPUT_PARSING} thất bại: ${errorMessage}`,
      );

      await this.safeTransitionToFailed(version, errorMessage, errorStack);
      throw error;
    }
  }

  /**
   * Stage 4: RESULT_MAPPING — Persist timetable slots within a transaction.
   * Progress: 85% → 95%
   * On failure: Transaction auto-rollback, transition to FAILED.
   */
  private async executeResultMapping(
    job: Job<GenerationJobPayload>,
    version: TimetableVersionEntity,
    slots: ParsedSlotDto[],
    versionId: string,
    schoolId: string,
  ): Promise<number> {
    this.logger.log(
      `[Job ${job.id}] Stage: ${PipelineStage.RESULT_MAPPING} — Lưu ${slots.length} slots vào DB`,
    );

    try {
      const outcome = await this.resultMapper.persistSlots(
        versionId,
        slots,
        schoolId,
      );

      if (!outcome.success) {
        throw new Error(`Lỗi lưu slots: ${outcome.errors.join('; ')}`);
      }

      // Update totalSlots on version
      await this.versionRepository.update(versionId, {
        totalSlots: outcome.slotCount,
      });

      await job.updateProgress(95);
      this.logger.log(
        `[Job ${job.id}] Stage ${PipelineStage.RESULT_MAPPING} hoàn thành — ${outcome.slotCount} slots đã lưu`,
      );

      return outcome.slotCount;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[Job ${job.id}] Stage ${PipelineStage.RESULT_MAPPING} thất bại: ${errorMessage}`,
      );

      await this.safeTransitionToFailed(version, errorMessage, errorStack);
      throw error;
    }
  }

  /**
   * Stage 5: CONFLICT_DETECTION — Run post-generation conflict checks.
   * Progress: 95% → 100%
   * On failure: Slots already committed → delete slots, transition to FAILED.
   */
  private async executeConflictDetection(
    job: Job<GenerationJobPayload>,
    version: TimetableVersionEntity,
    versionId: string,
    schoolId: string,
    slotCount: number,
  ): Promise<number> {
    this.logger.log(
      `[Job ${job.id}] Stage: ${PipelineStage.CONFLICT_DETECTION} — Kiểm tra xung đột`,
    );

    try {
      const conflicts =
        await this.conflictDetection.detectPostGenerationConflicts(
          versionId,
          schoolId,
        );

      const conflictCount = conflicts.length;

      // Transition version to GENERATED with conflict count
      await this.stateMachine.transition(
        version,
        TimetableVersionStatus.GENERATED,
        {
          conflictCount,
          warningFlag: conflictCount > 0,
        },
      );

      await job.updateProgress(100);
      this.logger.log(
        `[Job ${job.id}] Stage ${PipelineStage.CONFLICT_DETECTION} hoàn thành — ${conflictCount} xung đột phát hiện`,
      );

      return conflictCount;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[Job ${job.id}] Stage ${PipelineStage.CONFLICT_DETECTION} thất bại: ${errorMessage}`,
      );

      // Slots already committed — delete them on failure
      this.logger.warn(
        `[Job ${job.id}] Xóa ${slotCount} slots do lỗi ở giai đoạn conflict_detection`,
      );
      await this.safeDeleteSlots(versionId);

      await this.safeTransitionToFailed(version, errorMessage, errorStack);
      throw error;
    }
  }

  // ─── Helper Methods ────────────────────────────────────────────────────────

  /**
   * Loads the TimetableVersion entity, throwing if not found.
   */
  private async loadVersion(
    versionId: string,
  ): Promise<TimetableVersionEntity> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId },
    });

    if (!version) {
      throw new Error(`Không tìm thấy TimetableVersion: ${versionId}`);
    }

    return version;
  }

  /**
   * Builds FetParseContext from export result and input data.
   * Maps FET names to domain UUIDs for referential integrity validation.
   */
  private buildParseContext(
    exportResult: FetExportResult,
    inputData: FetInputData,
  ): FetParseContext {
    // Build dayMap: day name → dayOfWeek index
    const dayMap = new Map<string, number>();
    inputData.days.forEach((day, index) => {
      dayMap.set(day, index);
    });

    // Build periodMap: period name → period UUID
    const periodMap = new Map<string, string>();
    for (const pd of inputData.periodDefinitions) {
      periodMap.set(pd.name, pd.id);
    }

    // Build roomMap: room name → room UUID
    const roomMap = new Map<string, string>();
    for (const room of inputData.rooms) {
      roomMap.set(room.name, room.id);
    }

    // Build classMap: class name → class UUID
    const classMap = new Map<string, string>();
    for (const cls of inputData.classes) {
      classMap.set(cls.name, cls.id);
    }

    // Build teacherMap: teacher name → teacher UUID
    const teacherMap = new Map<string, string>();
    for (const teacher of inputData.teachers) {
      teacherMap.set(teacher.name, teacher.id);
    }

    return {
      activityMap: exportResult.activityMap,
      dayMap,
      periodMap,
      roomMap,
      classMap,
      teacherMap,
    };
  }

  /**
   * Safely transitions the version to FAILED status, catching any errors
   * from the state machine (e.g., already in FAILED state).
   */
  private async safeTransitionToFailed(
    version: TimetableVersionEntity,
    errorMessage: string,
    errorStack?: string,
  ): Promise<void> {
    try {
      // Reload version to get latest state (avoid optimistic lock conflict)
      const freshVersion = await this.versionRepository.findOne({
        where: { id: version.id },
      });

      if (!freshVersion) {
        this.logger.warn(
          `Cannot transition version ${version.id} to FAILED — not found`,
        );
        return;
      }

      // Only transition if currently in GENERATING state
      if (freshVersion.status !== TimetableVersionStatus.GENERATING) {
        this.logger.warn(
          `Version ${version.id} is in '${freshVersion.status}', skipping FAILED transition`,
        );
        return;
      }

      await this.stateMachine.transition(
        freshVersion,
        TimetableVersionStatus.FAILED,
        {
          errorMessage,
          errorStack,
        },
      );
    } catch (transitionError: unknown) {
      const msg =
        transitionError instanceof Error
          ? transitionError.message
          : String(transitionError);
      this.logger.error(
        `Không thể chuyển version ${version.id} sang FAILED: ${msg}`,
      );
    }
  }

  /**
   * Safely deletes all slots for a version on conflict_detection failure.
   * Uses soft delete to maintain audit trail.
   */
  private async safeDeleteSlots(versionId: string): Promise<void> {
    try {
      await this.slotRepository.deleteByVersion(versionId);
    } catch (deleteError: unknown) {
      const msg =
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError);
      this.logger.error(`Không thể xóa slots cho version ${versionId}: ${msg}`);
    }
  }
}
