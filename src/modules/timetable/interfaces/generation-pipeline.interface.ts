/**
 * Generation Pipeline Interfaces — contracts for all pipeline components.
 * Each interface defines the public API of a pipeline stage, enabling
 * independent testing and decoupled implementations.
 */

import { Observable } from 'rxjs';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import {
  FetInputData,
  FetExportResult,
  FetSolveParams,
  FetSolveResult,
  FetParseContext,
  FetParseResult,
  ParsedSlotDto,
} from './fet-dto.interface';
import { SubmitGenerationDto } from '../dto/submit-generation.dto';

// ─── Pipeline Service ────────────────────────────────────────────────────────

export interface GenerationSubmissionResult {
  jobId: string;
  versionId: string;
  status: TimetableVersionStatus;
}

export interface GenerationJobStatus {
  jobId: string;
  versionId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  stage: string;
  errorMessage?: string;
  completedAt?: Date;
}

export interface IGenerationPipelineService {
  submitGeneration(
    dto: SubmitGenerationDto,
    user: CurrentUserPayload,
  ): Promise<GenerationSubmissionResult>;
  getJobStatus(jobId: string, schoolId: string): Promise<GenerationJobStatus>;
  cancelJob(jobId: string, schoolId: string): Promise<void>;
}

// ─── State Machine ───────────────────────────────────────────────────────────

export interface TransitionMetadata {
  userId?: string;
  errorMessage?: string;
  errorStack?: string;
  warningFlag?: boolean;
  conflictCount?: number;
}

export interface ITimetableVersionStateMachine {
  transition(
    version: TimetableVersionEntity,
    targetStatus: TimetableVersionStatus,
    metadata?: TransitionMetadata,
  ): Promise<TimetableVersionEntity>;

  canTransition(
    currentStatus: TimetableVersionStatus,
    targetStatus: TimetableVersionStatus,
  ): boolean;
}

// ─── FET Input Exporter ──────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface IFetInputExporter {
  export(input: FetInputData): FetExportResult;
  validate(input: FetInputData): ValidationResult;
}

// ─── FET Engine Adapter ──────────────────────────────────────────────────────

export interface IFetEngineAdapter {
  solve(params: FetSolveParams): Promise<FetSolveResult>;
}

// ─── FET Output Parser ───────────────────────────────────────────────────────

export interface IFetOutputParser {
  parse(xml: string, context: FetParseContext): FetParseResult;
}

// ─── Result Mapper ───────────────────────────────────────────────────────────

export interface ResultMapperOutcome {
  success: boolean;
  slotCount: number;
  errors: string[];
}

export interface IResultMapper {
  persistSlots(
    versionId: string,
    slots: ParsedSlotDto[],
    schoolId: string,
  ): Promise<ResultMapperOutcome>;
}

// ─── Progress Gateway ────────────────────────────────────────────────────────

export interface ProgressEvent {
  versionId: string;
  stage: string;
  progress: number;
  message: string;
  timestamp: Date;
}

export interface IProgressGateway {
  streamProgress(
    versionId: string,
    schoolId: string,
  ): Observable<ProgressEvent>;
}
