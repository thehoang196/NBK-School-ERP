import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { ConflictIndexes } from '../interfaces/conflict-index.interface';
import {
  Conflict,
  SlotCheckPayload,
  ConflictCheckOptions,
} from '../interfaces/conflict.interface';
import { ConflictSeverity } from '../enums/conflict.enum';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import {
  TeacherDoubleBookedChecker,
  RoomDoubleBookedChecker,
  ClassDoubleBookedChecker,
  TeacherMaxConsecutiveChecker,
  TeacherTravelTimeChecker,
  SubjectConsecutiveDaysChecker,
  TeacherMaxPerDayChecker,
} from './checkers';
import { ConflictChecker } from '../interfaces/conflict-index.interface';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY TYPES — kept for backward compatibility with existing callers.
// Will be removed in task 11.1 when callers are migrated to new interfaces.
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use ConflictType from '../enums/conflict.enum' instead */
export enum ConflictType {
  TEACHER_CONFLICT = 'teacher_conflict',
  CLASS_CONFLICT = 'class_conflict',
  ROOM_CONFLICT = 'room_conflict',
  TEACHER_MAX_PERIODS = 'teacher_max_periods',
  TEACHER_UNAVAILABLE = 'teacher_unavailable',
  CROSS_SCHOOL_CONFLICT = 'cross_school_conflict',
}

/** @deprecated Use Conflict from '../interfaces/conflict.interface' instead */
export interface ConflictResult {
  type: ConflictType;
  severity: 'error' | 'warning';
  message: string;
  details: {
    slotId?: string;
    teacherId?: string;
    classId?: string;
    roomId?: string;
    dayOfWeek?: number;
    periodId?: string;
  };
}

/**
 * @deprecated Legacy interface kept for backward compat with FET generation pipeline.
 */
export interface PostGenerationConflictResult {
  type:
    'teacher_double_booking' | 'class_double_booking' | 'room_double_booking';
  entityId: string;
  dayOfWeek: number;
  periodId: string;
  slotIds: string[];
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW INDEX-BASED CONFLICT DETECTION SERVICE
// ─────────────────────────────────────────────────────────────────────────────

/** TTL for cross-school slots cache entries in milliseconds (10 minutes) */
const CROSS_SCHOOL_CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CrossSchoolBusySlot {
  dayOfWeek: number;
  periodId: string;
  schoolId: string;
}

@Injectable()
export class ConflictDetectionService {
  private readonly logger = new Logger(ConflictDetectionService.name);
  private readonly hardCheckers: ConflictChecker[];
  private readonly softCheckers: ConflictChecker[];

  /** In-memory cache for cross-school busy slots. Key pattern: cross_slots:{teacherId}:{semesterId} */
  private readonly crossSchoolCache = new Map<
    string,
    CacheEntry<CrossSchoolBusySlot[]>
  >();

  constructor(
    private readonly slotRepository: TimetableSlotRepository,
    private readonly versionRepository: TimetableVersionRepository,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TimetableVersionEntity)
    private readonly timetableVersionRepo: Repository<TimetableVersionEntity>,
    private readonly teacherDoubleBookedChecker: TeacherDoubleBookedChecker,
    private readonly roomDoubleBookedChecker: RoomDoubleBookedChecker,
    private readonly classDoubleBookedChecker: ClassDoubleBookedChecker,
    private readonly teacherMaxConsecutiveChecker: TeacherMaxConsecutiveChecker,
    private readonly teacherTravelTimeChecker: TeacherTravelTimeChecker,
    private readonly subjectConsecutiveDaysChecker: SubjectConsecutiveDaysChecker,
    private readonly teacherMaxPerDayChecker: TeacherMaxPerDayChecker,
    private readonly teacherSchoolAssignmentService: TeacherSchoolAssignmentService,
  ) {
    this.hardCheckers = [
      this.teacherDoubleBookedChecker,
      this.roomDoubleBookedChecker,
      this.classDoubleBookedChecker,
    ];
    this.softCheckers = [
      this.teacherMaxConsecutiveChecker,
      this.teacherTravelTimeChecker,
      this.subjectConsecutiveDaysChecker,
      this.teacherMaxPerDayChecker,
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW API — Index-based detection (pure validator, report-only)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Core detection method — runs all checkers against a target slot.
   * Uses pre-built index maps for O(1) lookup per check.
   * Never throws exceptions — returns Conflict[] array.
   */
  detectConflicts(
    target: SlotCheckPayload,
    indexes: ConflictIndexes,
    options: ConflictCheckOptions,
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Always run hard checks
    for (const checker of this.hardCheckers) {
      conflicts.push(...checker.check(target, indexes));
    }

    // Skip soft checks if option set
    if (!options.skipSoftChecks) {
      for (const checker of this.softCheckers) {
        conflicts.push(...checker.check(target, indexes));
      }
    }

    return conflicts;
  }

  /**
   * Build index maps from a collection of slots — single O(n) pass.
   * Called once for full-version/batch, reused for all slots.
   */
  buildIndexes(
    slots: TimetableSlotEntity[],
    periodOrderMap: Map<string, number>,
    roomCampusMap?: Map<string, string>,
  ): ConflictIndexes {
    const teacherTimeslot = new Map<string, TimetableSlotEntity>();
    const roomTimeslot = new Map<string, TimetableSlotEntity>();
    const classTimeslot = new Map<string, TimetableSlotEntity>();
    const teacherDayPeriods = new Map<string, number[]>();
    const subjectDays = new Map<string, number[]>();
    const teacherDaySlots = new Map<string, TimetableSlotEntity[]>();

    // Single O(n) pass
    for (const slot of slots) {
      const dayPeriodKey = `${slot.dayOfWeek}-${slot.periodId}`;

      // Teacher timeslot index
      teacherTimeslot.set(`${slot.teacherId}-${dayPeriodKey}`, slot);

      // Room timeslot index
      if (slot.roomId) {
        roomTimeslot.set(`${slot.roomId}-${dayPeriodKey}`, slot);
      }

      // Class timeslot index
      classTimeslot.set(`${slot.classId}-${dayPeriodKey}`, slot);

      // Teacher day periods
      const tdKey = `${slot.teacherId}-${slot.dayOfWeek}`;
      const periodOrder = periodOrderMap.get(slot.periodId);
      if (periodOrder !== undefined) {
        const existing = teacherDayPeriods.get(tdKey);
        if (existing) {
          existing.push(periodOrder);
        } else {
          teacherDayPeriods.set(tdKey, [periodOrder]);
        }
      }

      // Teacher day slots
      const existingSlots = teacherDaySlots.get(tdKey);
      if (existingSlots) {
        existingSlots.push(slot);
      } else {
        teacherDaySlots.set(tdKey, [slot]);
      }

      // Subject days
      const sdKey = `${slot.classId}-${slot.subjectId}`;
      const existingDays = subjectDays.get(sdKey);
      if (existingDays) {
        existingDays.push(slot.dayOfWeek);
      } else {
        subjectDays.set(sdKey, [slot.dayOfWeek]);
      }
    }

    return {
      teacherTimeslot,
      roomTimeslot,
      classTimeslot,
      teacherDayPeriods,
      subjectDays,
      teacherDaySlots,
      periodOrderMap,
      roomCampusMap: roomCampusMap ?? new Map(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CROSS-SCHOOL CONFLICT DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check cross-school conflicts cho một teacher tại một timeslot.
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   *
   * Algorithm:
   * 1. Check cache first for busy slots from other schools
   * 2. If cache miss, query timetable_slots joined with timetable_versions for other schools
   * 3. If same (dayOfWeek, periodId) found at another school → return CROSS_SCHOOL_CONFLICT
   */
  async checkCrossSchoolConflicts(
    teacherId: string,
    dayOfWeek: number,
    periodId: string,
    currentSchoolId: string,
    semesterId: string,
  ): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];

    // Get busy slots from other schools (uses cache)
    const busySlots = await this.getCrossSchoolBusySlots(
      teacherId,
      currentSchoolId,
      semesterId,
    );

    // Check if there's a conflict at (dayOfWeek, periodId) in other schools
    const conflictingSlots = busySlots.filter(
      (slot) => slot.dayOfWeek === dayOfWeek && slot.periodId === periodId,
    );

    for (const conflictSlot of conflictingSlots) {
      conflicts.push({
        type: ConflictType.CROSS_SCHOOL_CONFLICT,
        severity: 'error',
        message: `Giáo viên đã có tiết dạy tại trường khác vào thời điểm này`,
        details: {
          teacherId,
          dayOfWeek,
          periodId,
        },
      });
    }

    return conflicts;
  }

  /**
   * Pre-load cross-school busy slots cho FET engine.
   * Validates: Requirements 3.1, 3.3, 3.4
   *
   * Returns all (dayOfWeek, periodId, schoolId) where the teacher
   * is already assigned at other schools for the given semester.
   *
   * Cache key: cross_slots:{teacherId}:{semesterId}, TTL 10 min.
   */
  async getCrossSchoolBusySlots(
    teacherId: string,
    excludeSchoolId: string,
    semesterId: string,
  ): Promise<CrossSchoolBusySlot[]> {
    const cacheKey = `cross_slots:${teacherId}:${semesterId}`;

    // Check cache first
    const cached = this.getFromCrossSchoolCache(cacheKey);
    if (cached !== undefined) {
      // Filter to exclude the current school from cached results
      return cached.filter((slot) => slot.schoolId !== excludeSchoolId);
    }

    // Cache miss — query DB for ALL schools' busy slots for this teacher
    const busySlots = await this.queryOtherSchoolSlots(teacherId, semesterId);

    // Store ALL busy slots in cache (without excludeSchoolId filter)
    this.setCrossSchoolCache(cacheKey, busySlots);

    // Return filtered results
    return busySlots.filter((slot) => slot.schoolId !== excludeSchoolId);
  }

  /**
   * Invalidate cross-school cache for a teacher when timetable slots change.
   * Should be called when:
   * - Timetable slots are created/updated/deleted for cross-school teachers
   * - A timetable version is published/archived
   */
  invalidateCrossSchoolCache(teacherId: string, semesterId?: string): void {
    if (semesterId) {
      const cacheKey = `cross_slots:${teacherId}:${semesterId}`;
      this.crossSchoolCache.delete(cacheKey);
      this.logger.debug(
        `Cross-school cache invalidated for teacher ${teacherId}, semester ${semesterId}`,
      );
    } else {
      // Invalidate all entries for this teacher
      const keysToDelete: string[] = [];
      for (const key of this.crossSchoolCache.keys()) {
        if (key.startsWith(`cross_slots:${teacherId}:`)) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.crossSchoolCache.delete(key);
      }
      this.logger.debug(
        `Cross-school cache invalidated for teacher ${teacherId} (all semesters, ${keysToDelete.length} entries)`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CROSS-SCHOOL CACHE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private getFromCrossSchoolCache(
    key: string,
  ): CrossSchoolBusySlot[] | undefined {
    const entry = this.crossSchoolCache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.crossSchoolCache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCrossSchoolCache(key: string, value: CrossSchoolBusySlot[]): void {
    this.crossSchoolCache.set(key, {
      value,
      expiresAt: Date.now() + CROSS_SCHOOL_CACHE_TTL_MS,
    });
  }

  /**
   * Query timetable_slots from all schools where teacher is assigned,
   * joined with published/active timetable_versions for the given semester.
   */
  private async queryOtherSchoolSlots(
    teacherId: string,
    semesterId: string,
  ): Promise<CrossSchoolBusySlot[]> {
    // Get all schools where teacher is assigned
    const accessibleSchoolIds =
      await this.teacherSchoolAssignmentService.getAccessibleSchoolIds(
        teacherId,
      );

    if (accessibleSchoolIds.length <= 1) {
      // Teacher only has one school — no cross-school slots possible
      return [];
    }

    // Query published timetable versions for these schools in the given semester
    const publishedVersions = await this.timetableVersionRepo.find({
      where: {
        semesterId,
        status: TimetableVersionStatus.PUBLISHED,
        schoolId: In(accessibleSchoolIds),
        deletedAt: IsNull(),
      },
      select: ['id', 'schoolId'],
    });

    if (publishedVersions.length === 0) {
      return [];
    }

    const versionIds = publishedVersions.map((v) => v.id);
    const versionSchoolMap = new Map<string, string>();
    for (const v of publishedVersions) {
      if (v.schoolId) {
        versionSchoolMap.set(v.id, v.schoolId);
      }
    }

    // Query all slots for this teacher in those versions
    const slots = await this.slotRepository.findCrossSchoolSlots(
      teacherId,
      versionIds,
    );

    // Map to CrossSchoolBusySlot
    return slots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      periodId: slot.periodId,
      schoolId: versionSchoolMap.get(slot.versionId) ?? slot.schoolId,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY METHODS — preserved for backward compat until task 11.1 migration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @deprecated Use detectConflicts() + buildIndexes() instead.
   * Kept for backward compat with TimetableSlotService.
   */
  async checkSlotConflicts(
    versionId: string,
    dayOfWeek: number,
    periodId: string,
    teacherId: string,
    classId: string,
    roomId: string | null,
    excludeSlotId?: string,
  ): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];

    // Lấy tất cả slots cùng version, ngày, tiết
    const existingSlots = await this.slotRepository.findConflicts({
      versionId,
      dayOfWeek,
      periodId,
      excludeId: excludeSlotId,
    });

    // Check teacher conflict - GV dạy 2 lớp cùng lúc
    const teacherConflict = existingSlots.find(
      (s) => s.teacherId === teacherId,
    );
    if (teacherConflict) {
      conflicts.push({
        type: ConflictType.TEACHER_CONFLICT,
        severity: 'error',
        message: `Giáo viên đã có tiết dạy vào thời điểm này`,
        details: {
          slotId: teacherConflict.id,
          teacherId,
          dayOfWeek,
          periodId,
        },
      });
    }

    // Check class conflict - Lớp có 2 tiết cùng lúc
    const classConflict = existingSlots.find((s) => s.classId === classId);
    if (classConflict) {
      conflicts.push({
        type: ConflictType.CLASS_CONFLICT,
        severity: 'error',
        message: `Lớp đã có tiết học vào thời điểm này`,
        details: {
          slotId: classConflict.id,
          classId,
          dayOfWeek,
          periodId,
        },
      });
    }

    // Check room conflict - Phòng bị dùng 2 lần cùng lúc
    if (roomId) {
      const roomConflict = existingSlots.find((s) => s.roomId === roomId);
      if (roomConflict) {
        conflicts.push({
          type: ConflictType.ROOM_CONFLICT,
          severity: 'error',
          message: `Phòng học đã được sử dụng vào thời điểm này`,
          details: {
            slotId: roomConflict.id,
            roomId,
            dayOfWeek,
            periodId,
          },
        });
      }
    }

    // Check teacher max periods per day
    await this.checkTeacherMaxPeriodsPerDay(
      versionId,
      dayOfWeek,
      teacherId,
      excludeSlotId,
      conflicts,
    );

    // Check teacher unavailable slots
    await this.checkTeacherUnavailable(
      teacherId,
      dayOfWeek,
      periodId,
      conflicts,
    );

    return conflicts;
  }

  /**
   * @deprecated Use detectConflicts() + buildIndexes() instead.
   * Kept for backward compat with TimetablePublishService and TimetableService.
   */
  async checkAllConflicts(versionId: string): Promise<ConflictResult[]> {
    const allSlots = await this.slotRepository.findByVersion(versionId);
    const conflicts: ConflictResult[] = [];

    // Group by dayOfWeek + periodId
    const slotMap = new Map<string, typeof allSlots>();
    for (const slot of allSlots) {
      const key = `${slot.dayOfWeek}-${slot.periodId}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, []);
      }
      slotMap.get(key)!.push(slot);
    }

    for (const [, slotsInTimeslot] of slotMap) {
      // Check teacher conflicts
      const teacherIds = slotsInTimeslot.map((s) => s.teacherId);
      const duplicateTeachers = teacherIds.filter(
        (id, idx) => teacherIds.indexOf(id) !== idx,
      );
      for (const teacherId of duplicateTeachers) {
        const conflictSlots = slotsInTimeslot.filter(
          (s) => s.teacherId === teacherId,
        );
        conflicts.push({
          type: ConflictType.TEACHER_CONFLICT,
          severity: 'error',
          message: `Giáo viên dạy ${conflictSlots.length} lớp cùng lúc`,
          details: {
            teacherId,
            dayOfWeek: slotsInTimeslot[0].dayOfWeek,
            periodId: slotsInTimeslot[0].periodId,
          },
        });
      }

      // Check room conflicts
      const roomIds = slotsInTimeslot
        .filter((s) => s.roomId)
        .map((s) => s.roomId!);
      const duplicateRooms = roomIds.filter(
        (id, idx) => roomIds.indexOf(id) !== idx,
      );
      for (const roomId of duplicateRooms) {
        conflicts.push({
          type: ConflictType.ROOM_CONFLICT,
          severity: 'error',
          message: `Phòng học được dùng bởi nhiều lớp cùng lúc`,
          details: {
            roomId,
            dayOfWeek: slotsInTimeslot[0].dayOfWeek,
            periodId: slotsInTimeslot[0].periodId,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * @deprecated Batch post-generation conflict detection — runs AFTER slots are persisted.
   * Uses O(n) hash-map grouping to detect hard-constraint violations.
   * Kept for backward compat with TimetableGenerationProcessor.
   */
  async detectPostGenerationConflicts(
    versionId: string,
    schoolId: string,
  ): Promise<PostGenerationConflictResult[]> {
    this.logger.log(
      `Bắt đầu kiểm tra xung đột hậu sinh TKB cho version ${versionId}, trường ${schoolId}`,
    );

    // Step 1: Query all slots for this version
    const allSlots = await this.slotRepository.findByVersion(versionId);

    // Step 2: Build hash maps — O(n) grouping
    const teacherSlotMap = new Map<string, string[]>();
    const classSlotMap = new Map<string, string[]>();
    const roomSlotMap = new Map<string, string[]>();

    for (const slot of allSlots) {
      // Teacher grouping: {teacherId}_{dayOfWeek}_{periodId}
      const teacherKey = `${slot.teacherId}_${slot.dayOfWeek}_${slot.periodId}`;
      if (!teacherSlotMap.has(teacherKey)) {
        teacherSlotMap.set(teacherKey, []);
      }
      teacherSlotMap.get(teacherKey)!.push(slot.id);

      // Class grouping: {classId}_{dayOfWeek}_{periodId}
      const classKey = `${slot.classId}_${slot.dayOfWeek}_${slot.periodId}`;
      if (!classSlotMap.has(classKey)) {
        classSlotMap.set(classKey, []);
      }
      classSlotMap.get(classKey)!.push(slot.id);

      // Room grouping: {roomId}_{dayOfWeek}_{periodId} — skip null roomId
      if (slot.roomId) {
        const roomKey = `${slot.roomId}_${slot.dayOfWeek}_${slot.periodId}`;
        if (!roomSlotMap.has(roomKey)) {
          roomSlotMap.set(roomKey, []);
        }
        roomSlotMap.get(roomKey)!.push(slot.id);
      }
    }

    // Step 3: Detect conflicts — entries with more than 1 slot
    const conflicts: PostGenerationConflictResult[] = [];

    for (const [key, slotIds] of teacherSlotMap) {
      if (slotIds.length > 1) {
        const [teacherId, dayOfWeekStr, periodId] = key.split('_');
        conflicts.push({
          type: 'teacher_double_booking',
          entityId: teacherId,
          dayOfWeek: Number(dayOfWeekStr),
          periodId,
          slotIds,
          message: `Giáo viên bị trùng lịch: dạy ${slotIds.length} lớp cùng thứ ${dayOfWeekStr}, cùng tiết`,
        });
      }
    }

    for (const [key, slotIds] of classSlotMap) {
      if (slotIds.length > 1) {
        const [classId, dayOfWeekStr, periodId] = key.split('_');
        conflicts.push({
          type: 'class_double_booking',
          entityId: classId,
          dayOfWeek: Number(dayOfWeekStr),
          periodId,
          slotIds,
          message: `Lớp bị trùng lịch: có ${slotIds.length} tiết học cùng thứ ${dayOfWeekStr}, cùng tiết`,
        });
      }
    }

    for (const [key, slotIds] of roomSlotMap) {
      if (slotIds.length > 1) {
        const [roomId, dayOfWeekStr, periodId] = key.split('_');
        conflicts.push({
          type: 'room_double_booking',
          entityId: roomId,
          dayOfWeek: Number(dayOfWeekStr),
          periodId,
          slotIds,
          message: `Phòng học bị trùng lịch: được sử dụng bởi ${slotIds.length} lớp cùng thứ ${dayOfWeekStr}, cùng tiết`,
        });
      }
    }

    // Step 4: Store conflict details on TimetableVersion
    const hasConflicts = conflicts.length > 0;
    await this.versionRepository.update(versionId, {
      hasConflicts,
      conflictCount: conflicts.length,
      conflictDetails: hasConflicts ? conflicts : null,
    });

    this.logger.log(
      `Hoàn tất kiểm tra xung đột: phát hiện ${conflicts.length} xung đột cho version ${versionId}`,
    );

    return conflicts;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS (for legacy methods)
  // ─────────────────────────────────────────────────────────────────────────

  private async checkTeacherMaxPeriodsPerDay(
    versionId: string,
    dayOfWeek: number,
    teacherId: string,
    excludeSlotId: string | undefined,
    conflicts: ConflictResult[],
  ): Promise<void> {
    const teacher = await this.teacherRepo.findOne({
      where: { id: teacherId },
    });
    if (!teacher) return;

    // Đếm số tiết GV đang dạy trong ngày
    const allSlots = await this.slotRepository.findByQuery({
      versionId,
      teacherId,
    });
    const slotsInDay = allSlots.filter(
      (s) => s.dayOfWeek === dayOfWeek && s.id !== excludeSlotId,
    );

    if (slotsInDay.length >= teacher.maxPeriodsPerDay) {
      conflicts.push({
        type: ConflictType.TEACHER_MAX_PERIODS,
        severity: 'warning',
        message: `Giáo viên đã đạt số tiết tối đa/ngày (${teacher.maxPeriodsPerDay})`,
        details: {
          teacherId,
          dayOfWeek,
        },
      });
    }
  }

  private async checkTeacherUnavailable(
    teacherId: string,
    dayOfWeek: number,
    periodId: string,
    conflicts: ConflictResult[],
  ): Promise<void> {
    const teacher = await this.teacherRepo.findOne({
      where: { id: teacherId },
    });
    if (!teacher || !teacher.unavailableSlots) return;

    const isUnavailable = teacher.unavailableSlots.some(
      (slot) => slot.dayOfWeek === dayOfWeek && slot.periodId === periodId,
    );

    if (isUnavailable) {
      conflicts.push({
        type: ConflictType.TEACHER_UNAVAILABLE,
        severity: 'error',
        message: `Giáo viên không thể dạy vào thời điểm này (đã đăng ký không khả dụng)`,
        details: {
          teacherId,
          dayOfWeek,
          periodId,
        },
      });
    }
  }
}
