import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TeacherWorkloadEntity } from '../entities/teacher-workload.entity';
import { TeachingMetricsService } from './teaching-metrics.service';
import { PayPeriodService } from './pay-period.service';

@Injectable()
export class TeacherWorkloadService {
  private readonly logger = new Logger(TeacherWorkloadService.name);

  constructor(
    @InjectRepository(TeacherWorkloadEntity)
    private readonly repo: Repository<TeacherWorkloadEntity>,
    private readonly teachingMetricsService: TeachingMetricsService,
    private readonly payPeriodService: PayPeriodService,
  ) {}

  /**
   * Lấy workload cho 1 giáo viên trong 1 kỳ lương.
   */
  async getWorkload(
    teacherId: string,
    payPeriodId: string,
    schoolId: string,
  ): Promise<TeacherWorkloadEntity | null> {
    return this.repo.findOne({
      where: { teacherId, payPeriodId, schoolId, deletedAt: IsNull() },
    });
  }

  /**
   * Tính toán và lưu workload cho 1 GV.
   * Upsert: nếu đã có thì update.
   */
  async calculateWorkload(
    teacherId: string,
    payPeriodId: string,
    schoolId: string,
  ): Promise<TeacherWorkloadEntity> {
    const payPeriod = await this.payPeriodService.findById(payPeriodId);

    const metrics = await this.teachingMetricsService.getTeachingMetrics(
      teacherId,
      schoolId,
      payPeriod.startDate,
      payPeriod.endDate,
    );

    const existing = await this.repo.findOne({
      where: { teacherId, payPeriodId, schoolId, deletedAt: IsNull() },
    });

    if (existing) {
      existing.totalHours = metrics.totalHours;
      existing.hoursByType = metrics.hoursByType;
      existing.hoursBySubject = metrics.hoursBySubject;
      return this.repo.save(existing);
    }

    const entity = this.repo.create({
      schoolId,
      teacherId,
      payPeriodId,
      totalHours: metrics.totalHours,
      hoursByType: metrics.hoursByType,
      hoursBySubject: metrics.hoursBySubject,
    });
    return this.repo.save(entity);
  }

  /**
   * Tính lại workload cho tất cả GV trong 1 kỳ.
   */
  async regenerateWorkload(
    payPeriodId: string,
    schoolId: string,
    teacherIds: string[],
  ): Promise<{ successCount: number; errorCount: number }> {
    let successCount = 0;
    let errorCount = 0;

    for (const teacherId of teacherIds) {
      try {
        await this.calculateWorkload(teacherId, payPeriodId, schoolId);
        successCount++;
      } catch (error) {
        this.logger.warn(
          `Lỗi tính workload GV ${teacherId}: ${(error as Error).message}`,
        );
        errorCount++;
      }
    }

    return { successCount, errorCount };
  }
}
