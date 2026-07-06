import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TeacherEntity } from '../entities/teacher.entity';
import {
  DuplicateMatch,
  DeduplicationResult,
  MergeResult,
  MergeReferenceDetail,
  MergeOptions,
} from '../interfaces/data-quality.interface';
import { TeachersMergedEvent } from '../events/teacher.events';

/**
 * Service để phát hiện và xử lý duplicate teachers.
 * Hỗ trợ:
 * - Fuzzy matching (fullName similarity, citizenId, phone, email)
 * - Admin review workflow (trả danh sách potential duplicates)
 * - Merge với FK re-pointing và soft-delete secondary
 */
@Injectable()
export class DataQualityService {
  private readonly logger = new Logger(DataQualityService.name);

  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Phát hiện potential duplicates trong một trường dựa trên:
   * 1. Exact match: citizenId, phone, email
   * 2. Fuzzy match: fullName similarity (Levenshtein distance)
   * 3. EmployeeCode pattern similarity
   */
  async deduplicateTeachers(
    schoolId: string,
    similarityThreshold = 80,
  ): Promise<DeduplicationResult> {
    const teachers = await this.teacherRepo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { fullName: 'ASC' },
    });

    const matches: DuplicateMatch[] = [];

    // Phase 1: Exact match on unique identifiers (O(n) with hash sets)
    const citizenIdMap = new Map<string, TeacherEntity[]>();
    const phoneMap = new Map<string, TeacherEntity[]>();
    const emailMap = new Map<string, TeacherEntity[]>();

    for (const teacher of teachers) {
      if (teacher.citizenId) {
        const key = teacher.citizenId.trim();
        if (!citizenIdMap.has(key)) citizenIdMap.set(key, []);
        citizenIdMap.get(key)!.push(teacher);
      }
      if (teacher.phone) {
        const key = this.normalizePhone(teacher.phone);
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key)!.push(teacher);
      }
      if (teacher.email) {
        const key = teacher.email.trim().toLowerCase();
        if (!emailMap.has(key)) emailMap.set(key, []);
        emailMap.get(key)!.push(teacher);
      }
    }

    // Report exact duplicates
    this.collectExactDuplicates(
      citizenIdMap,
      'citizenId',
      'Trùng CMND/CCCD',
      matches,
    );
    this.collectExactDuplicates(
      phoneMap,
      'phone',
      'Trùng số điện thoại',
      matches,
    );
    this.collectExactDuplicates(emailMap, 'email', 'Trùng email', matches);

    // Phase 2: Fuzzy name matching (O(n²) but bounded by school size)
    const seenPairs = new Set<string>();
    // Add already-found pairs to avoid reporting them twice
    for (const match of matches) {
      seenPairs.add(this.pairKey(match.teacherA.id, match.teacherB.id));
    }

    for (let i = 0; i < teachers.length; i++) {
      for (let j = i + 1; j < teachers.length; j++) {
        const pairKey = this.pairKey(teachers[i].id, teachers[j].id);
        if (seenPairs.has(pairKey)) continue;

        const score = this.calculateNameSimilarity(
          teachers[i].fullName,
          teachers[j].fullName,
        );

        if (score >= similarityThreshold) {
          const matchedFields: string[] = ['fullName'];

          // Boost score if other fields also match
          if (
            teachers[i].dateOfBirth &&
            teachers[j].dateOfBirth &&
            teachers[i].dateOfBirth === teachers[j].dateOfBirth
          ) {
            matchedFields.push('dateOfBirth');
          }

          if (
            teachers[i].gender &&
            teachers[j].gender &&
            teachers[i].gender === teachers[j].gender
          ) {
            matchedFields.push('gender');
          }

          matches.push({
            teacherA: teachers[i],
            teacherB: teachers[j],
            similarityScore: score,
            matchedFields,
            reason: `Tên tương tự (${score}% giống nhau)`,
          });
          seenPairs.add(pairKey);
        }
      }
    }

    // Sort by score descending (most likely duplicates first)
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    this.logger.log(
      `Deduplication scan: ${teachers.length} teachers, found ${matches.length} potential duplicates`,
    );

    return {
      totalScanned: teachers.length,
      matches,
    };
  }

  /**
   * Merge secondary teacher into primary teacher.
   * - Updates all FK references pointing to secondary → primary
   * - Optionally keeps specific fields from secondary
   * - Soft-deletes secondary
   * - All within a transaction (atomic)
   */
  async mergeTeachers(
    primaryId: string,
    secondaryId: string,
    options: MergeOptions = {},
  ): Promise<MergeResult> {
    if (primaryId === secondaryId) {
      throw new BadRequestException(
        'Không thể merge một giáo viên với chính mình',
      );
    }

    const primary = await this.teacherRepo.findOne({
      where: { id: primaryId, deletedAt: IsNull() },
    });
    if (!primary) {
      throw new BadRequestException(
        `Không tìm thấy giáo viên chính (primary) với ID "${primaryId}"`,
      );
    }

    const secondary = await this.teacherRepo.findOne({
      where: { id: secondaryId, deletedAt: IsNull() },
    });
    if (!secondary) {
      throw new BadRequestException(
        `Không tìm thấy giáo viên phụ (secondary) với ID "${secondaryId}"`,
      );
    }

    if (primary.schoolId !== secondary.schoolId) {
      throw new ConflictException('Hai giáo viên phải thuộc cùng một trường');
    }

    const referenceDetails: MergeReferenceDetail[] = [];
    let totalReferencesUpdated = 0;

    await this.dataSource.transaction(async (manager) => {
      // Step 1: Optionally merge fields from secondary into primary
      if (
        options.keepFieldsFromSecondary &&
        options.keepFieldsFromSecondary.length > 0
      ) {
        const updates: Partial<TeacherEntity> = {};
        for (const field of options.keepFieldsFromSecondary) {
          const value = secondary[field];
          if (value !== null && value !== undefined) {
            (updates as Record<string, unknown>)[field] = value;
          }
        }
        if (Object.keys(updates).length > 0) {
          await manager.update(TeacherEntity, primaryId, updates);
        }
      }

      // Step 2: Re-point all FK references from secondary → primary
      // Using raw queries for efficiency and to handle all tables consistently

      const fkTables: Array<{ table: string; column: string }> = [
        { table: 'timetable_slots', column: 'teacher_id' },
        { table: 'actual_timetable_slots', column: 'teacher_id' },
        { table: 'actual_timetable_slots', column: 'original_teacher_id' },
        { table: 'teaching_assignments', column: 'teacher_id' },
        { table: 'teacher_subjects', column: 'teacher_id' },
        { table: 'classes', column: 'homeroom_teacher_id' },
        { table: 'salary_slips', column: 'teacher_id' },
        { table: 'users', column: 'teacher_id' },
        { table: 'department_members', column: 'teacher_id' },
        { table: 'departments', column: 'head_teacher_id' },
      ];

      for (const { table, column } of fkTables) {
        // Handle unique constraint conflicts for teacher_subjects and teaching_assignments
        // by first checking if the primary already has the same link
        if (table === 'teacher_subjects') {
          // Delete secondary's subject links that already exist on primary
          await manager.query(
            `DELETE FROM teacher_subjects
             WHERE teacher_id = $1
               AND subject_id IN (
                 SELECT subject_id FROM teacher_subjects WHERE teacher_id = $2
               )`,
            [secondaryId, primaryId],
          );
        }

        if (table === 'teaching_assignments') {
          // For teaching assignments with unique constraint, skip duplicates
          await manager.query(
            `DELETE FROM teaching_assignments
             WHERE teacher_id = $1
               AND (semester_id, class_id, subject_id) IN (
                 SELECT semester_id, class_id, subject_id
                 FROM teaching_assignments WHERE teacher_id = $2
               )`,
            [secondaryId, primaryId],
          );
        }

        const result = await manager.query(
          `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
          [primaryId, secondaryId],
        );

        const rowsUpdated = result[1] ?? 0;
        if (rowsUpdated > 0) {
          referenceDetails.push({ table, column, rowsUpdated });
          totalReferencesUpdated += rowsUpdated;
        }
      }

      // Step 3: Soft-delete secondary teacher
      await manager.softDelete(TeacherEntity, secondaryId);
    });

    this.logger.log(
      `Merged teacher ${secondaryId} → ${primaryId}: ${totalReferencesUpdated} references updated`,
    );

    // Emit event for downstream systems
    this.eventEmitter.emit(
      TeachersMergedEvent.eventName,
      new TeachersMergedEvent(
        primaryId,
        secondaryId,
        primary.schoolId,
        totalReferencesUpdated,
      ),
    );

    return {
      primaryTeacherId: primaryId,
      secondaryTeacherId: secondaryId,
      referencesUpdated: totalReferencesUpdated,
      referenceDetails,
    };
  }

  // ─── FUZZY MATCHING HELPERS ─────────────────────────────────────────────

  /**
   * Calculate name similarity using normalized Levenshtein distance.
   * Returns 0-100 score.
   */
  private calculateNameSimilarity(nameA: string, nameB: string): number {
    const a = this.normalizeName(nameA);
    const b = this.normalizeName(nameB);

    if (a === b) return 100;
    if (a.length === 0 || b.length === 0) return 0;

    const distance = this.levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    const similarity = ((maxLen - distance) / maxLen) * 100;

    return Math.round(similarity);
  }

  /**
   * Normalize Vietnamese name for comparison:
   * - Lowercase
   * - Remove diacritics
   * - Collapse whitespace
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Levenshtein distance (edit distance) between two strings.
   */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Optimize: use single array instead of full matrix
    const prev = new Array<number>(n + 1);
    const curr = new Array<number>(n + 1);

    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1, // insertion
          prev[j] + 1, // deletion
          prev[j - 1] + cost, // substitution
        );
      }
      for (let j = 0; j <= n; j++) prev[j] = curr[j];
    }

    return prev[n];
  }

  /**
   * Normalize phone number: remove spaces, dashes, +84 prefix.
   */
  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[\s\-\.\(\)]/g, '');
    if (normalized.startsWith('+84')) {
      normalized = '0' + normalized.slice(3);
    }
    if (normalized.startsWith('84') && normalized.length === 11) {
      normalized = '0' + normalized.slice(2);
    }
    return normalized;
  }

  /**
   * Collect exact duplicate groups from a map.
   */
  private collectExactDuplicates(
    map: Map<string, TeacherEntity[]>,
    field: string,
    reason: string,
    matches: DuplicateMatch[],
  ): void {
    for (const [, group] of map) {
      if (group.length < 2) continue;
      // Create pairs from the group
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          matches.push({
            teacherA: group[i],
            teacherB: group[j],
            similarityScore: 100,
            matchedFields: [field],
            reason,
          });
        }
      }
    }
  }

  /**
   * Create a deterministic pair key to avoid duplicates in results.
   */
  private pairKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }
}
