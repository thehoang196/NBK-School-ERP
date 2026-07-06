/**
 * FET Domain DTOs — Data shapes used by the FET generation pipeline.
 * These interfaces decouple the pipeline from database entities,
 * enabling the FET input/output layers to operate as pure functions.
 */

// ─── FET Input DTOs ─────────────────────────────────────────────────────────

export interface TeachingAssignmentDto {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  periodsPerWeek: number;
}

export interface TeacherDto {
  id: string;
  name: string;
  maxPeriodsPerDay: number;
}

export interface TeacherAvailabilityDto {
  teacherId: string;
  unavailableSlots: Array<{ dayOfWeek: number; periodId: string }>;
}

export interface ClassDto {
  id: string;
  name: string;
  gradeId: string;
}

export interface SubjectDto {
  id: string;
  name: string;
}

export interface RoomDto {
  id: string;
  name: string;
  capacity: number;
}

export interface RoomConstraintDto {
  subjectId: string;
  roomId: string;
  /** 100 = mandatory, <100 = preferred */
  weight: number;
}

export interface PeriodDefinitionDto {
  id: string;
  periodNumber: number;
  name: string;
  sessionId: string;
}

// ─── FET Input Data (aggregate) ─────────────────────────────────────────────

export interface FetInputData {
  institution: string;
  schoolId: string;
  semesterId: string;
  teachingAssignments: TeachingAssignmentDto[];
  teachers: TeacherDto[];
  classes: ClassDto[];
  subjects: SubjectDto[];
  rooms: RoomDto[];
  periodDefinitions: PeriodDefinitionDto[];
  days: string[];
  teacherAvailability: TeacherAvailabilityDto[];
  roomConstraints: RoomConstraintDto[];
}

// ─── FET Export Result ───────────────────────────────────────────────────────

export interface ActivityMetadata {
  teachingAssignmentId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  duration: number;
}

export interface FetExportResult {
  xml: string;
  /** FET activity ID → domain entity references */
  activityMap: Map<string, ActivityMetadata>;
}

// ─── FET Solve (Engine Adapter) ─────────────────────────────────────────────

export interface FetSolveParams {
  inputXml: string;
  timeoutSeconds: number;
  /** For log correlation */
  jobId: string;
}

export interface FetSolveResult {
  success: boolean;
  outputXml: string | null;
  exitCode: number;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  partialResult: boolean;
}

// ─── FET Output Parsing ─────────────────────────────────────────────────────

export interface FetParseContext {
  activityMap: Map<string, ActivityMetadata>;
  /** FET day name → dayOfWeek integer (0=Monday, 1=Tuesday, etc.) */
  dayMap: Map<string, number>;
  /** FET hour name → period UUID */
  periodMap: Map<string, string>;
  /** FET room name → room UUID */
  roomMap: Map<string, string>;
  /** FET students set → class UUID */
  classMap: Map<string, string>;
  /** FET teacher name → teacher UUID */
  teacherMap: Map<string, string>;
}

export interface FetParseError {
  activityId: string;
  field: string;
  message: string;
  rawValue: string;
}

export interface FetParseResult {
  success: boolean;
  slots: ParsedSlotDto[];
  errors: FetParseError[];
  warnings: string[];
}

export interface ParsedSlotDto {
  teacherId: string;
  classId: string;
  subjectId: string;
  roomId: string | null;
  dayOfWeek: number;
  periodId: string;
  isDoublePeriod: boolean;
}
