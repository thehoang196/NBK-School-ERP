import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ActualTimetableSlotEntity } from '../../timetable/entities/actual-timetable-slot.entity';
import { TeachingActivityType } from '../enums';

/**
 * Kết quả nhóm tiết dạy theo loại activity.
 */
export interface TeachingMetricsResult {
  teacherId: string;
  totalHours: number;
  hoursByType: Record<TeachingActivityType, number>;
  hoursBySubject: Record<string, number>;
}

/**
 * Cấu hình mapping subject → activity type.
 * Mặc định theo quy tắc NBK. Có thể mở rộng qua Rule Engine sau.
 */
export interface SubjectActivityMapping {
  subjectId: string;
  activityType: TeachingActivityType;
}

@Injectable()
export class TeachingMetricsService {
  private readonly logger = new Logger(TeachingMetricsService.name);

  constructor(
    @InjectRepository(ActualTimetableSlotEntity)
    private readonly slotRepository: Repository<ActualTimetableSlotEntity>,
  ) {}

  /**
   * Lấy số tiết dạy tổng hợp cho 1 giáo viên trong khoảng thời gian.
   * Query actual_timetable_slots theo teacher_id, group theo subject.
   */
  async getTeachingMetrics(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
    subjectActivityMappings?: SubjectActivityMapping[],
  ): Promise<TeachingMetricsResult> {
    // Query tổng slots per subject
    const slots = await this.slotRepository
      .createQueryBuilder('slot')
      .select('slot.subject_id', 'subjectId')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('slot.week', 'week')
      .where('slot.teacher_id = :teacherId', { teacherId })
      .andWhere('slot.school_id = :schoolId', { schoolId })
      .andWhere('week.start_date >= :startDate', { startDate })
      .andWhere('week.end_date <= :endDate', { endDate })
      .andWhere('slot.deleted_at IS NULL')
      .groupBy('slot.subject_id')
      .getRawMany<{ subjectId: string; count: string }>();

    // Build hoursBySubject
    const hoursBySubject: Record<string, number> = {};
    let totalHours = 0;
    for (const row of slots) {
      const count = parseInt(row.count, 10);
      hoursBySubject[row.subjectId] = count;
      totalHours += count;
    }

    // Map subject → activity type
    const hoursByType = this.groupByActivityType(
      hoursBySubject,
      subjectActivityMappings || [],
    );

    return {
      teacherId,
      totalHours,
      hoursByType,
      hoursBySubject,
    };
  }

  /**
   * Lấy tổng số tiết dạy (không phân loại) cho 1 GV trong khoảng thời gian.
   */
  async getTotalTeachingHours(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const result = await this.slotRepository
      .createQueryBuilder('slot')
      .select('COUNT(*)', 'count')
      .innerJoin('slot.week', 'week')
      .where('slot.teacher_id = :teacherId', { teacherId })
      .andWhere('slot.school_id = :schoolId', { schoolId })
      .andWhere('week.start_date >= :startDate', { startDate })
      .andWhere('week.end_date <= :endDate', { endDate })
      .andWhere('slot.deleted_at IS NULL')
      .getRawOne<{ count: string }>();

    return result ? parseInt(result.count, 10) : 0;
  }

  /**
   * Lấy số tiết dạy cho 1 môn cụ thể.
   */
  async getTeachingHoursBySubject(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
    subjectId: string,
  ): Promise<number> {
    const result = await this.slotRepository
      .createQueryBuilder('slot')
      .select('COUNT(*)', 'count')
      .innerJoin('slot.week', 'week')
      .where('slot.teacher_id = :teacherId', { teacherId })
      .andWhere('slot.school_id = :schoolId', { schoolId })
      .andWhere('slot.subject_id = :subjectId', { subjectId })
      .andWhere('week.start_date >= :startDate', { startDate })
      .andWhere('week.end_date <= :endDate', { endDate })
      .andWhere('slot.deleted_at IS NULL')
      .getRawOne<{ count: string }>();

    return result ? parseInt(result.count, 10) : 0;
  }

  /**
   * Lấy số tiết dạy theo loại activity type.
   * Requires subject → activity type mapping.
   */
  async getTeachingHoursByType(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
    activityType: TeachingActivityType,
    subjectActivityMappings: SubjectActivityMapping[],
  ): Promise<number> {
    // Lấy danh sách subject_ids thuộc activity type này
    const subjectIds = subjectActivityMappings
      .filter((m) => m.activityType === activityType)
      .map((m) => m.subjectId);

    if (subjectIds.length === 0) {
      // Nếu không có mapping, và type = REGULAR thì đếm tất cả subject không thuộc type khác
      if (activityType === TeachingActivityType.REGULAR) {
        const mappedSubjectIds = subjectActivityMappings.map((m) => m.subjectId);
        return this.countSlotsExcludingSubjects(
          teacherId,
          schoolId,
          startDate,
          endDate,
          mappedSubjectIds,
        );
      }
      return 0;
    }

    const result = await this.slotRepository
      .createQueryBuilder('slot')
      .select('COUNT(*)', 'count')
      .innerJoin('slot.week', 'week')
      .where('slot.teacher_id = :teacherId', { teacherId })
      .andWhere('slot.school_id = :schoolId', { schoolId })
      .andWhere('slot.subject_id IN (:...subjectIds)', { subjectIds })
      .andWhere('week.start_date >= :startDate', { startDate })
      .andWhere('week.end_date <= :endDate', { endDate })
      .andWhere('slot.deleted_at IS NULL')
      .getRawOne<{ count: string }>();

    return result ? parseInt(result.count, 10) : 0;
  }

  /**
   * Đếm slots KHÔNG thuộc danh sách subjects (dùng cho REGULAR type fallback).
   */
  private async countSlotsExcludingSubjects(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
    excludeSubjectIds: string[],
  ): Promise<number> {
    const qb = this.slotRepository
      .createQueryBuilder('slot')
      .select('COUNT(*)', 'count')
      .innerJoin('slot.week', 'week')
      .where('slot.teacher_id = :teacherId', { teacherId })
      .andWhere('slot.school_id = :schoolId', { schoolId })
      .andWhere('week.start_date >= :startDate', { startDate })
      .andWhere('week.end_date <= :endDate', { endDate })
      .andWhere('slot.deleted_at IS NULL');

    if (excludeSubjectIds.length > 0) {
      qb.andWhere('slot.subject_id NOT IN (:...excludeSubjectIds)', {
        excludeSubjectIds,
      });
    }

    const result = await qb.getRawOne<{ count: string }>();
    return result ? parseInt(result.count, 10) : 0;
  }

  /**
   * Group hoursBySubject vào hoursByType dựa trên mapping.
   * Subjects không có mapping → REGULAR.
   */
  private groupByActivityType(
    hoursBySubject: Record<string, number>,
    mappings: SubjectActivityMapping[],
  ): Record<TeachingActivityType, number> {
    const result: Record<TeachingActivityType, number> = {
      [TeachingActivityType.REGULAR]: 0,
      [TeachingActivityType.TOAN_VAN_ANH]: 0,
      [TeachingActivityType.HUAN_LUYEN]: 0,
      [TeachingActivityType.LUYEN_THI]: 0,
      [TeachingActivityType.IELTS]: 0,
      [TeachingActivityType.CLB]: 0,
      [TeachingActivityType.TAM_LY]: 0,
    };

    const subjectToType = new Map<string, TeachingActivityType>();
    for (const m of mappings) {
      subjectToType.set(m.subjectId, m.activityType);
    }

    for (const [subjectId, hours] of Object.entries(hoursBySubject)) {
      const type = subjectToType.get(subjectId) || TeachingActivityType.REGULAR;
      result[type] += hours;
    }

    return result;
  }
}
