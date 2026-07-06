export enum ConflictType {
  // Hard constraints
  TEACHER_DOUBLE_BOOKED = 'TEACHER_DOUBLE_BOOKED',
  ROOM_DOUBLE_BOOKED = 'ROOM_DOUBLE_BOOKED',
  CLASS_DOUBLE_BOOKED = 'CLASS_DOUBLE_BOOKED',
  // Soft constraints
  TEACHER_MAX_CONSECUTIVE_EXCEEDED = 'TEACHER_MAX_CONSECUTIVE_EXCEEDED',
  TEACHER_INSUFFICIENT_TRAVEL_TIME = 'TEACHER_INSUFFICIENT_TRAVEL_TIME',
  SUBJECT_CONSECUTIVE_DAYS = 'SUBJECT_CONSECUTIVE_DAYS',
  TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED = 'TEACHER_MAX_PERIODS_PER_DAY_EXCEEDED',
}

export enum ConflictSeverity {
  ERROR = 'error',
  WARNING = 'warning',
}

export enum ValidationContext {
  SINGLE_SLOT = 'single_slot',
  FULL_VERSION = 'full_version',
  BATCH_IMPORT = 'batch_import',
}

export enum ConflictLogStatus {
  DETECTED = 'detected',
  OVERRIDDEN = 'overridden',
  RESOLVED = 'resolved',
}
