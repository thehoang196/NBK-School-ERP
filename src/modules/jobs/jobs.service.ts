import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import { JobRecordEntity, JobStatus } from './entities/job-record.entity';
import { JobQueryDto } from './dto/job-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

export interface CreateJobInput {
  schoolId: string;
  jobType: string;
  queueName: string;
  bullJobId?: string;
  payload?: Record<string, unknown>;
  createdBy?: string;
  maxAttempts?: number;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly jobsRepository: JobsRepository) {}

  async createJob(input: CreateJobInput): Promise<JobRecordEntity> {
    return this.jobsRepository.create({
      schoolId: input.schoolId,
      jobType: input.jobType,
      queueName: input.queueName,
      bullJobId: input.bullJobId ?? null,
      payload: input.payload ?? null,
      createdBy: input.createdBy ?? null,
      maxAttempts: input.maxAttempts ?? 3,
      status: JobStatus.PENDING,
      progress: 0,
    });
  }

  async getJobById(id: string): Promise<JobRecordEntity> {
    const job = await this.jobsRepository.findById(id);
    if (!job) {
      throw new NotFoundException('Không tìm thấy job');
    }
    return job;
  }

  async getJobs(
    query: JobQueryDto,
    schoolId: string | null,
  ): Promise<PaginatedResponse<JobRecordEntity>> {
    const [data, total] = await this.jobsRepository.findAll(query, schoolId);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách job thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async markActive(id: string, bullJobId?: string): Promise<void> {
    await this.jobsRepository.updateStatus(id, JobStatus.ACTIVE, {
      startedAt: new Date(),
      ...(bullJobId && { bullJobId }),
    });
  }

  async markCompleted(
    id: string,
    result?: Record<string, unknown>,
  ): Promise<void> {
    await this.jobsRepository.updateStatus(id, JobStatus.COMPLETED, {
      completedAt: new Date(),
      progress: 100,
      result: result ?? null,
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.jobsRepository.updateStatus(id, JobStatus.FAILED, {
      completedAt: new Date(),
      errorMessage,
    });
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    await this.jobsRepository.updateProgress(id, clampedProgress);
  }
}
