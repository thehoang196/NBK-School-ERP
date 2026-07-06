import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { TeachingAssignmentRepository } from '../teaching-assignment.repository';

export interface WorkloadValidationResult {
  valid: boolean;
  message?: string;
  currentPeriods: number;
  maxPeriods: number;
  requestedPeriods: number;
}

/**
 * WorkloadValidator — Kiểm tra giáo viên có vượt định mức giảng dạy tối đa không.
 *
 * Quy tắc:
 * - Tổng số tiết/tuần (hiện tại + mới) KHÔNG được vượt maxPeriodsPerWeek
 * - Nếu vượt → trả valid = false + message tiếng Việt
 */
@Injectable()
export class WorkloadValidator {
  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    private readonly teachingAssignmentRepository: TeachingAssignmentRepository,
  ) {}

  async validate(
    teacherId: string,
    semesterId: string,
    periodsPerWeek: number,
    excludeAssignmentId?: string,
  ): Promise<WorkloadValidationResult> {
    const teacher = await this.teacherRepo.findOne({
      where: { id: teacherId, deletedAt: IsNull() },
    });

    if (!teacher) {
      return {
        valid: false,
        message: 'Không tìm thấy giáo viên',
        currentPeriods: 0,
        maxPeriods: 0,
        requestedPeriods: periodsPerWeek,
      };
    }

    let currentPeriods =
      await this.teachingAssignmentRepository.sumPeriodsByTeacher(
        teacherId,
        semesterId,
      );

    // Nếu đang update, trừ đi số tiết của assignment hiện tại
    if (excludeAssignmentId) {
      const existing =
        await this.teachingAssignmentRepository.findById(excludeAssignmentId);
      if (existing) {
        currentPeriods -= existing.periodsPerWeek;
      }
    }

    const totalAfterAdd = currentPeriods + periodsPerWeek;

    if (totalAfterAdd > teacher.maxPeriodsPerWeek) {
      return {
        valid: false,
        message: `Giáo viên ${teacher.fullName} đã vượt định mức giảng dạy tối đa (${teacher.maxPeriodsPerWeek} tiết/tuần). Hiện tại: ${currentPeriods}, yêu cầu thêm: ${periodsPerWeek}, tổng: ${totalAfterAdd}.`,
        currentPeriods,
        maxPeriods: teacher.maxPeriodsPerWeek,
        requestedPeriods: periodsPerWeek,
      };
    }

    return {
      valid: true,
      currentPeriods,
      maxPeriods: teacher.maxPeriodsPerWeek,
      requestedPeriods: periodsPerWeek,
    };
  }
}
