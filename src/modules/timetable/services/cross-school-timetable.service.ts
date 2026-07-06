import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';

/**
 * Merged timetable slot interface for cross-school teacher view.
 * Combines slot data with school information and travel warnings.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 */
export interface MergedTimetableSlot {
  id: string;
  dayOfWeek: number;
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  roomId: string | null;
  roomName: string | null;
  schoolId: string;
  schoolName: string;
  schoolAddress: string | null;
  hasTravelWarning: boolean;
}

/**
 * Service cung cấp merged timetable view cho giáo viên cross-school.
 * Queries timetable slots from all accessible schools, joins school info,
 * and detects travel warnings for consecutive slots at different schools.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 */
@Injectable()
export class CrossSchoolTimetableService {
  private readonly logger = new Logger(CrossSchoolTimetableService.name);

  constructor(
    private readonly teacherSchoolAssignmentService: TeacherSchoolAssignmentService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lấy merged timetable cho cross-school teacher.
   * Query timetable_slots from all accessible schools, join school name/address,
   * merge into single list sorted by day + startTime.
   *
   * Validates: Requirements 5.1, 5.2, 5.5
   *
   * @param teacherId - Teacher UUID
   * @param semesterId - Semester UUID
   * @param filterSchoolId - Optional school filter (only return slots for this school)
   * @returns MergedTimetableSlot[] with travel warnings applied
   */
  async getMergedTimetable(
    teacherId: string,
    semesterId: string,
    filterSchoolId?: string,
  ): Promise<MergedTimetableSlot[]> {
    // Step 1: Get accessible school IDs for teacher
    const accessibleSchoolIds =
      await this.teacherSchoolAssignmentService.getAccessibleSchoolIds(
        teacherId,
      );

    if (accessibleSchoolIds.length === 0) {
      return [];
    }

    // Step 2: Apply school filter if provided
    const targetSchoolIds = filterSchoolId
      ? accessibleSchoolIds.filter((id) => id === filterSchoolId)
      : accessibleSchoolIds;

    if (targetSchoolIds.length === 0) {
      return [];
    }

    // Step 3: Find published timetable versions for accessible schools in the given semester
    const publishedVersions = await this.dataSource
      .getRepository(TimetableVersionEntity)
      .find({
        where: {
          semesterId,
          schoolId: In(targetSchoolIds),
          status: TimetableVersionStatus.PUBLISHED,
          deletedAt: IsNull(),
        },
        select: ['id', 'schoolId'],
      });

    if (publishedVersions.length === 0) {
      return [];
    }

    const versionIds = publishedVersions.map((v) => v.id);

    // Step 4: Query slots for this teacher from all published versions,
    // joining period, class, subject, room, and school data
    const slots = await this.dataSource
      .getRepository(TimetableSlotEntity)
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.period', 'period')
      .leftJoinAndSelect('slot.class', 'cls')
      .leftJoinAndSelect('slot.subject', 'subject')
      .leftJoinAndSelect('slot.room', 'room')
      .leftJoin('slot.timetableVersion', 'version')
      .leftJoin('schools', 'school', 'school.id = slot.school_id')
      .addSelect(['school.id', 'school.name', 'school.address'])
      .where('slot.teacher_id = :teacherId', { teacherId })
      .andWhere('slot.version_id IN (:...versionIds)', { versionIds })
      .andWhere('slot.deletedAt IS NULL')
      .getRawAndEntities();

    // Step 5: Build a map of schoolId → school info from versions
    const schoolInfoMap = new Map<
      string,
      { name: string; address: string | null }
    >();
    for (const version of publishedVersions) {
      if (version.schoolId && !schoolInfoMap.has(version.schoolId)) {
        const school = await this.dataSource.query(
          `SELECT "name", "address" FROM "schools" WHERE "id" = $1 AND "deleted_at" IS NULL LIMIT 1`,
          [version.schoolId],
        );
        if (school.length > 0) {
          schoolInfoMap.set(version.schoolId, {
            name: school[0].name,
            address: school[0].address,
          });
        }
      }
    }

    // Step 6: Map to MergedTimetableSlot interface
    const mergedSlots: MergedTimetableSlot[] = slots.entities.map((slot) => {
      const schoolInfo = schoolInfoMap.get(slot.schoolId) ?? {
        name: '',
        address: null,
      };

      return {
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        periodId: slot.periodId,
        periodName: slot.period?.periodNumber?.toString() ?? '',
        startTime: slot.period?.startTime ?? '',
        endTime: slot.period?.endTime ?? '',
        classId: slot.classId,
        className: slot.class?.name ?? '',
        subjectId: slot.subjectId,
        subjectName: slot.subject?.name ?? '',
        roomId: slot.roomId,
        roomName: slot.room?.name ?? null,
        schoolId: slot.schoolId,
        schoolName: schoolInfo.name,
        schoolAddress: schoolInfo.address,
        hasTravelWarning: false,
      };
    });

    // Step 7: Detect travel warnings and return sorted result
    return this.detectTravelWarnings(mergedSlots);
  }

  /**
   * Detect travel warnings: 2 tiết liên tiếp ở khác trường trong cùng ngày.
   * Sort by day + startTime, mark hasTravelWarning=true when consecutive slots
   * are at different schools on the same day.
   *
   * Validates: Requirements 5.3
   *
   * @param slots - List of MergedTimetableSlot to analyze
   * @returns Sorted list with hasTravelWarning flags applied
   */
  detectTravelWarnings(slots: MergedTimetableSlot[]): MergedTimetableSlot[] {
    // Sort by dayOfWeek then by period start time
    const sorted = [...slots].sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startTime.localeCompare(b.startTime);
    });

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // Same day, different school → travel warning
      if (
        prev.dayOfWeek === curr.dayOfWeek &&
        prev.schoolId !== curr.schoolId
      ) {
        curr.hasTravelWarning = true;
      }
    }

    return sorted;
  }
}
