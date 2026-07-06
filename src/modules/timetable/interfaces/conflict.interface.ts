import {
  ConflictType,
  ConflictSeverity,
  ValidationContext,
} from '../enums/conflict.enum';

export interface Conflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  details: ConflictDetails;
}

export interface ConflictDetails {
  // The slot that was checked
  targetSlotId?: string;
  // The existing conflicting slot
  conflictingSlotId?: string;
  // Resource identifiers
  teacherId?: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  roomId?: string;
  roomName?: string;
  subjectId?: string;
  subjectName?: string;
  // Time identifiers
  dayOfWeek?: number;
  periodId?: string;
  periodOrder?: number;
  // Soft constraint details
  currentCount?: number;
  maxAllowed?: number;
  campusFrom?: string;
  campusTo?: string;
  affectedDays?: number[];
}

export interface SlotCheckPayload {
  versionId: string;
  dayOfWeek: number;
  periodId: string;
  teacherId: string;
  classId: string;
  roomId: string | null;
  subjectId: string;
  excludeSlotId?: string;
}

export interface ConflictCheckResult {
  hasHardConflicts: boolean;
  hasSoftConflicts: boolean;
  conflicts: Conflict[];
  hardCount: number;
  softCount: number;
}

export interface FullVersionConflictResult {
  versionId: string;
  totalSlots: number;
  totalConflicts: number;
  hardCount: number;
  softCount: number;
  byType: Record<ConflictType, Conflict[]>;
  conflicts: Conflict[];
}

export interface BatchConflictResult {
  totalSlots: number;
  validSlots: number;
  invalidSlots: number;
  conflicts: BatchSlotConflict[];
  canProceedWithOverride: boolean;
}

export interface BatchSlotConflict {
  rowIndex: number;
  slot: SlotCheckPayload;
  conflicts: Conflict[];
}

export interface OverridePayload {
  reason: string;
}

export interface ConflictCheckOptions {
  context: ValidationContext;
  schoolId: string;
  skipSoftChecks?: boolean;
}
