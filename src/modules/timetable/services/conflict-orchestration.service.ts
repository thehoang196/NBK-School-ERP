import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConflictDetectionService } from './conflict-detection.service';
import { ConflictSlotRepository } from '../repositories/conflict-slot.repository';
import { ConflictLogRepository } from '../repositories/conflict-log.repository';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import {
  Conflict,
  SlotCheckPayload,
  ConflictCheckResult,
  FullVersionConflictResult,
  BatchConflictResult,
  BatchSlotConflict,
  OverridePayload,
  ConflictCheckOptions,
} from '../interfaces/conflict.interface';
import {
  ConflictType,
  ConflictSeverity,
  ValidationContext,
  ConflictLogStatus,
} from '../enums/conflict.enum';
import { ConflictFilterDto } from '../dto/conflict-filter.dto';
import { CheckSlotConflictDto } from '../dto/check-slot-conflict.dto';
import {
  SchoolContextRequiredException,
  OverrideReasonTooShortException,
  ValidationTimeoutException,
} from '../exceptions/conflict.exception';

@Injectable()
export class ConflictOrchestrationService {
  private readonly logger = new Logger(ConflictOrchestrationService.name);

  /** Timeout for full-version check (10 seconds) */
  private readonly FULL_VERSION_TIMEOUT_MS = 10_000;

  constructor(
    private readonly conflictDetectionService: ConflictDetectionService,
    private readonly conflictSlotRepository: ConflictSlotRepository,
    private readonly conflictLogRepository: ConflictLogRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // SINGLE-SLOT CHECK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Single-slot check — loads minimal data, runs detection, logs results.
   * Optimized for real-time drag-and-drop (< 200ms target).
   */
  async checkSingleSlot(
    dto: CheckSlotConflictDto,
    schoolId: string,
    userId: string,
  ): Promise<ConflictCheckResult> {
    this.validateSchoolContext(schoolId);

    this.logger.debug(
      `checkSingleSlot: version=${dto.versionId}, day=${dto.dayOfWeek}, period=${dto.periodId}`,
    );

    // Load existing slots at the same timeslot
    const existingSlots = await this.conflictSlotRepository.loadExistingSlots(
      dto.versionId,
      dto.dayOfWeek,
      dto.periodId,
      schoolId,
    );

    // Load period order map and room campus map (graceful degradation)
    let periodOrderMap = new Map<string, number>();
    let roomCampusMap = new Map<string, string>();
    let skipSoftChecks = false;

    try {
      periodOrderMap =
        await this.conflictSlotRepository.loadPeriodOrderMap(schoolId);
    } catch (error) {
      this.logger.warn(
        'Failed to load periodOrderMap, skipping soft checks that need it',
      );
      skipSoftChecks = true;
    }

    try {
      roomCampusMap =
        await this.conflictSlotRepository.loadRoomCampusMap(schoolId);
    } catch (error) {
      this.logger.warn(
        'Failed to load roomCampusMap, skipping travel time check',
      );
    }

    // For single-slot context, we also need all teacher's slots on this day
    // and all class/subject combinations for subject-days check
    const allVersionSlots =
      await this.conflictSlotRepository.loadAllSlotsByVersion(
        dto.versionId,
        schoolId,
      );

    // Build indexes from all version slots
    const indexes = this.conflictDetectionService.buildIndexes(
      allVersionSlots,
      periodOrderMap,
      roomCampusMap,
    );

    // Build target payload
    const target: SlotCheckPayload = {
      versionId: dto.versionId,
      dayOfWeek: dto.dayOfWeek,
      periodId: dto.periodId,
      teacherId: dto.teacherId,
      classId: dto.classId,
      roomId: dto.roomId ?? null,
      subjectId: dto.subjectId,
      excludeSlotId: dto.excludeSlotId,
    };

    const options: ConflictCheckOptions = {
      context: ValidationContext.SINGLE_SLOT,
      schoolId,
      skipSoftChecks,
    };

    // Run detection
    const conflicts = this.conflictDetectionService.detectConflicts(
      target,
      indexes,
      options,
    );

    // Log conflicts
    if (conflicts.length > 0) {
      await this.logConflicts(
        conflicts,
        dto.versionId,
        schoolId,
        target,
        ValidationContext.SINGLE_SLOT,
      );
    }

    // Build result
    const hardConflicts = conflicts.filter(
      (c) => c.severity === ConflictSeverity.ERROR,
    );
    const softConflicts = conflicts.filter(
      (c) => c.severity === ConflictSeverity.WARNING,
    );

    return {
      hasHardConflicts: hardConflicts.length > 0,
      hasSoftConflicts: softConflicts.length > 0,
      conflicts,
      hardCount: hardConflicts.length,
      softCount: softConflicts.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FULL-VERSION CHECK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Full-version check — loads all slots, builds indexes, runs detection for each.
   * Wrapped in Promise.race with 10s timeout.
   */
  async checkFullVersion(
    versionId: string,
    schoolId: string,
    filters?: ConflictFilterDto,
  ): Promise<FullVersionConflictResult> {
    this.validateSchoolContext(schoolId);

    this.logger.debug(`checkFullVersion: version=${versionId}`);

    const result = await Promise.race([
      this.performFullVersionCheck(versionId, schoolId, filters),
      this.createTimeoutPromise<FullVersionConflictResult>(),
    ]);

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BATCH CHECK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Batch check — validates imported slots against existing + intra-batch.
   * Each slot is checked against existing indexes AND previously processed batch slots.
   */
  async checkBatch(
    slots: SlotCheckPayload[],
    versionId: string,
    schoolId: string,
  ): Promise<BatchConflictResult> {
    this.validateSchoolContext(schoolId);

    this.logger.debug(
      `checkBatch: version=${versionId}, batchSize=${slots.length}`,
    );

    // Step 1: Load existing slots for the version
    const existingSlots =
      await this.conflictSlotRepository.loadAllSlotsByVersion(
        versionId,
        schoolId,
      );

    // Step 2: Load periodOrderMap and roomCampusMap (graceful degradation)
    let periodOrderMap = new Map<string, number>();
    let roomCampusMap = new Map<string, string>();

    try {
      periodOrderMap =
        await this.conflictSlotRepository.loadPeriodOrderMap(schoolId);
    } catch (error) {
      this.logger.warn(
        'Failed to load periodOrderMap for batch check, skipping soft checks that need it',
      );
    }

    try {
      roomCampusMap =
        await this.conflictSlotRepository.loadRoomCampusMap(schoolId);
    } catch (error) {
      this.logger.warn(
        'Failed to load roomCampusMap for batch check, skipping travel time check',
      );
    }

    // Step 3: Build indexes from existing slots
    const indexes = this.conflictDetectionService.buildIndexes(
      existingSlots,
      periodOrderMap,
      roomCampusMap,
    );

    // Step 4: Process each batch slot, adding to indexes for intra-batch detection
    const batchConflicts: BatchSlotConflict[] = [];
    const options: ConflictCheckOptions = {
      context: ValidationContext.BATCH_IMPORT,
      schoolId,
    };

    for (let rowIndex = 0; rowIndex < slots.length; rowIndex++) {
      const slot = slots[rowIndex];

      // Check against existing data indexes + previously added batch slots
      const conflicts = this.conflictDetectionService.detectConflicts(
        slot,
        indexes,
        options,
      );

      if (conflicts.length > 0) {
        batchConflicts.push({
          rowIndex,
          slot,
          conflicts,
        });
      }

      // Add this slot to the indexes so subsequent slots can detect intra-batch conflicts
      this.addSlotToIndexes(indexes, slot, rowIndex, schoolId, periodOrderMap);
    }

    // Step 5: Calculate summary
    const totalSlots = slots.length;
    const invalidSlots = batchConflicts.filter((bc) =>
      bc.conflicts.some((c) => c.severity === ConflictSeverity.ERROR),
    ).length;
    const validSlots = totalSlots - invalidSlots;

    // canProceedWithOverride: true only if NO hard conflicts exist anywhere
    const hasAnyHardConflict = batchConflicts.some((bc) =>
      bc.conflicts.some((c) => c.severity === ConflictSeverity.ERROR),
    );
    const canProceedWithOverride = !hasAnyHardConflict;

    return {
      totalSlots,
      validSlots,
      invalidSlots,
      conflicts: batchConflicts,
      canProceedWithOverride,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OVERRIDE SOFT CONFLICTS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Override soft constraints and proceed with save.
   * Validates only soft conflicts present (rejects if any hard).
   * Validates reason length ≥ 10.
   */
  async overrideSoftConflicts(
    slotId: string,
    conflictLogIds: string[],
    override: OverridePayload,
    userId: string,
    schoolId: string,
  ): Promise<void> {
    this.validateSchoolContext(schoolId);

    this.logger.debug(
      `overrideSoftConflicts: slotId=${slotId}, logIds=${conflictLogIds.length}`,
    );

    // Step 1: Validate override reason length ≥ 10
    if (!override.reason || override.reason.length < 10) {
      throw new OverrideReasonTooShortException();
    }

    // Step 2: Load conflict logs by IDs (filtered by schoolId)
    const logs = await this.conflictLogRepository.findByIds(
      conflictLogIds,
      schoolId,
    );

    // Step 3: Validate all requested IDs were found
    if (logs.length !== conflictLogIds.length) {
      throw new HttpException(
        {
          success: false,
          data: null,
          message: 'Không tìm thấy bản ghi xung đột',
          errorCode: 'CONFLICT_LOG_NOT_FOUND',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Step 4: Validate ALL logs are soft constraints (severity === WARNING)
    const hasHardConflict = logs.some(
      (log) => log.severity === ConflictSeverity.ERROR,
    );

    if (hasHardConflict) {
      throw new HttpException(
        {
          success: false,
          data: null,
          message: 'Phát hiện xung đột cứng, không thể lưu',
          errorCode: 'HARD_CONFLICT_DETECTED',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Step 5: Update each log to OVERRIDDEN status
    for (const log of logs) {
      await this.conflictLogRepository.updateOverride(
        log.id,
        userId,
        override.reason,
      );
    }

    this.logger.log(
      `Successfully overridden ${logs.length} soft conflicts for slot ${slotId} by user ${userId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate that a valid school context (schoolId) is present.
   * Throws 403 SCHOOL_CONTEXT_REQUIRED if schoolId is null/undefined/empty.
   */
  private validateSchoolContext(
    schoolId: string | null | undefined,
  ): asserts schoolId is string {
    if (!schoolId) {
      throw new SchoolContextRequiredException();
    }
  }

  /**
   * Perform the actual full-version conflict check.
   */
  private async performFullVersionCheck(
    versionId: string,
    schoolId: string,
    filters?: ConflictFilterDto,
  ): Promise<FullVersionConflictResult> {
    // Load all slots for this version
    const allSlots = await this.conflictSlotRepository.loadAllSlotsByVersion(
      versionId,
      schoolId,
    );

    // Load supporting data (graceful degradation)
    let periodOrderMap = new Map<string, number>();
    let roomCampusMap = new Map<string, string>();
    let skipSoftChecks = false;

    try {
      periodOrderMap =
        await this.conflictSlotRepository.loadPeriodOrderMap(schoolId);
    } catch (error) {
      this.logger.warn('Failed to load periodOrderMap, skipping soft checks');
      skipSoftChecks = true;
    }

    try {
      roomCampusMap =
        await this.conflictSlotRepository.loadRoomCampusMap(schoolId);
    } catch (error) {
      this.logger.warn(
        'Failed to load roomCampusMap, travel time check skipped',
      );
    }

    // Build indexes once
    const indexes = this.conflictDetectionService.buildIndexes(
      allSlots,
      periodOrderMap,
      roomCampusMap,
    );

    const options: ConflictCheckOptions = {
      context: ValidationContext.FULL_VERSION,
      schoolId,
      skipSoftChecks,
    };

    // Run detection for each slot
    const allConflicts: Conflict[] = [];
    const seenConflictKeys = new Set<string>();

    for (const slot of allSlots) {
      const target: SlotCheckPayload = {
        versionId: slot.versionId,
        dayOfWeek: slot.dayOfWeek,
        periodId: slot.periodId,
        teacherId: slot.teacherId,
        classId: slot.classId,
        roomId: slot.roomId,
        subjectId: slot.subjectId,
        excludeSlotId: slot.id, // Exclude self
      };

      const conflicts = this.conflictDetectionService.detectConflicts(
        target,
        indexes,
        options,
      );

      // Deduplicate: conflicts between A-B and B-A are the same
      for (const conflict of conflicts) {
        const dedupeKey = this.buildDeduplicationKey(conflict, slot);
        if (!seenConflictKeys.has(dedupeKey)) {
          seenConflictKeys.add(dedupeKey);
          allConflicts.push(conflict);
        }
      }
    }

    // Apply filters if provided
    let filteredConflicts = allConflicts;
    if (filters) {
      filteredConflicts = this.applyFilters(allConflicts, filters);
    }

    // Group by type
    const byType = {} as Record<ConflictType, Conflict[]>;
    for (const type of Object.values(ConflictType)) {
      byType[type] = filteredConflicts.filter((c) => c.type === type);
    }

    const hardCount = filteredConflicts.filter(
      (c) => c.severity === ConflictSeverity.ERROR,
    ).length;
    const softCount = filteredConflicts.filter(
      (c) => c.severity === ConflictSeverity.WARNING,
    ).length;

    return {
      versionId,
      totalSlots: allSlots.length,
      totalConflicts: filteredConflicts.length,
      hardCount,
      softCount,
      byType,
      conflicts: filteredConflicts,
    };
  }

  /**
   * Add a batch slot to the indexes for intra-batch detection.
   * Creates a synthetic TimetableSlotEntity from SlotCheckPayload.
   */
  private addSlotToIndexes(
    indexes: ConflictIndexes,
    slot: SlotCheckPayload,
    rowIndex: number,
    schoolId: string,
    periodOrderMap: Map<string, number>,
  ): void {
    // Build a synthetic TimetableSlotEntity
    const syntheticSlot = {
      id: `batch-${rowIndex}`,
      versionId: slot.versionId,
      dayOfWeek: slot.dayOfWeek,
      periodId: slot.periodId,
      teacherId: slot.teacherId,
      classId: slot.classId,
      roomId: slot.roomId,
      subjectId: slot.subjectId,
      schoolId,
    } as unknown as TimetableSlotEntity;

    const dayPeriodKey = `${slot.dayOfWeek}-${slot.periodId}`;

    // Teacher timeslot index
    indexes.teacherTimeslot.set(
      `${slot.teacherId}-${dayPeriodKey}`,
      syntheticSlot,
    );

    // Room timeslot index
    if (slot.roomId) {
      indexes.roomTimeslot.set(`${slot.roomId}-${dayPeriodKey}`, syntheticSlot);
    }

    // Class timeslot index
    indexes.classTimeslot.set(`${slot.classId}-${dayPeriodKey}`, syntheticSlot);

    // Teacher day periods
    const tdKey = `${slot.teacherId}-${slot.dayOfWeek}`;
    const periodOrder = periodOrderMap.get(slot.periodId);
    if (periodOrder !== undefined) {
      const existing = indexes.teacherDayPeriods.get(tdKey);
      if (existing) {
        existing.push(periodOrder);
      } else {
        indexes.teacherDayPeriods.set(tdKey, [periodOrder]);
      }
    }

    // Teacher day slots
    const existingSlots = indexes.teacherDaySlots.get(tdKey);
    if (existingSlots) {
      existingSlots.push(syntheticSlot);
    } else {
      indexes.teacherDaySlots.set(tdKey, [syntheticSlot]);
    }

    // Subject days
    const sdKey = `${slot.classId}-${slot.subjectId}`;
    const existingDays = indexes.subjectDays.get(sdKey);
    if (existingDays) {
      existingDays.push(slot.dayOfWeek);
    } else {
      indexes.subjectDays.set(sdKey, [slot.dayOfWeek]);
    }
  }

  /**
   * Log detected conflicts to the audit table.
   */
  private async logConflicts(
    conflicts: Conflict[],
    versionId: string,
    schoolId: string,
    target: SlotCheckPayload,
    context: ValidationContext,
  ): Promise<void> {
    try {
      const logEntries = conflicts.map((conflict) => ({
        schoolId,
        versionId,
        conflictType: conflict.type,
        severity: conflict.severity,
        dayOfWeek: target.dayOfWeek,
        periodId: target.periodId,
        teacherId: conflict.details.teacherId ?? target.teacherId,
        classId: conflict.details.classId ?? target.classId,
        roomId: conflict.details.roomId ?? target.roomId,
        subjectId: conflict.details.subjectId ?? target.subjectId,
        conflictingSlotId: conflict.details.conflictingSlotId ?? null,
        message: conflict.message,
        details: conflict.details,
        validationContext: context,
        status: ConflictLogStatus.DETECTED,
        detectedAt: new Date(),
      }));

      await this.conflictLogRepository.createManyLogs(logEntries);
    } catch (error) {
      // Log but don't fail the main operation if audit logging fails
      this.logger.error('Failed to log conflicts to audit table', error);
    }
  }

  /**
   * Build a deduplication key for conflict to avoid duplicates
   * (e.g., teacher A conflicts with slot B and slot B conflicts with teacher A).
   */
  private buildDeduplicationKey(
    conflict: Conflict,
    slot: TimetableSlotEntity,
  ): string {
    const conflictingSlotId = conflict.details.conflictingSlotId ?? 'unknown';
    const slotIds = [slot.id, conflictingSlotId].sort().join(':');
    return `${conflict.type}:${slotIds}`;
  }

  /**
   * Apply filters to conflict results.
   */
  private applyFilters(
    conflicts: Conflict[],
    filters: ConflictFilterDto,
  ): Conflict[] {
    let result = conflicts;

    if (filters.type) {
      result = result.filter((c) => c.type === filters.type);
    }

    if (filters.severity) {
      result = result.filter((c) => c.severity === filters.severity);
    }

    if (filters.teacherId) {
      result = result.filter((c) => c.details.teacherId === filters.teacherId);
    }

    if (filters.classId) {
      result = result.filter((c) => c.details.classId === filters.classId);
    }

    return result;
  }

  /**
   * Create a timeout promise that rejects after FULL_VERSION_TIMEOUT_MS.
   */
  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new ValidationTimeoutException());
      }, this.FULL_VERSION_TIMEOUT_MS);
    });
  }
}
