import { TeacherEntity } from '../entities/teacher.entity';

/**
 * Represents a pair of potential duplicate teachers with a similarity score.
 */
export interface DuplicateMatch {
  /** Teacher A */
  teacherA: TeacherEntity;
  /** Teacher B */
  teacherB: TeacherEntity;
  /** Similarity score 0-100 (100 = exact match) */
  similarityScore: number;
  /** Fields that matched */
  matchedFields: string[];
  /** Reason for flagging as duplicate */
  reason: string;
}

/**
 * Result of running deduplication detection.
 */
export interface DeduplicationResult {
  /** Total teachers scanned */
  totalScanned: number;
  /** Potential duplicate pairs found */
  matches: DuplicateMatch[];
}

/**
 * Result of merging two teacher records.
 */
export interface MergeResult {
  /** ID of the primary (surviving) teacher */
  primaryTeacherId: string;
  /** ID of the secondary (merged/soft-deleted) teacher */
  secondaryTeacherId: string;
  /** Number of FK references updated */
  referencesUpdated: number;
  /** Details of each table/count updated */
  referenceDetails: MergeReferenceDetail[];
}

export interface MergeReferenceDetail {
  table: string;
  column: string;
  rowsUpdated: number;
}

/**
 * Options for the merge operation.
 */
export interface MergeOptions {
  /** Which fields from secondary to keep (override primary) */
  keepFieldsFromSecondary?: Array<keyof TeacherEntity>;
  /** If true, preserve secondary as soft-deleted with a merge reference */
  preserveHistory?: boolean;
}
