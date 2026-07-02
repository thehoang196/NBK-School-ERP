import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TimetableGeneratorService } from '../services/timetable-generator.service';

export interface TimetableGenerationJobData {
  semesterId: string;
  versionId: string;
  timeoutSeconds?: number;
}

export interface TimetableGenerationResult {
  jobId: string;
  status: 'completed' | 'failed';
  totalSlots: number;
  message: string;
}

@Processor('timetable-generation')
export class TimetableGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(TimetableGenerationProcessor.name);

  constructor(
    private readonly generatorService: TimetableGeneratorService,
  ) {
    super();
  }

  async process(job: Job<TimetableGenerationJobData>): Promise<TimetableGenerationResult> {
    const { semesterId, versionId, timeoutSeconds } = job.data;
    const timeout = timeoutSeconds ?? 300;

    this.logger.log(
      `Bắt đầu sinh TKB - Job: ${job.id}, Semester: ${semesterId}, Version: ${versionId}`,
    );

    try {
      await job.updateProgress(10);

      const generationJobId = await this.generatorService.generate(
        semesterId,
        versionId,
        timeout,
      );

      await job.updateProgress(30);
      this.logger.log(`Đã khởi tạo generation job: ${generationJobId}`);

      // Poll for completion
      const result = await this.waitForCompletion(job, generationJobId);

      await job.updateProgress(100);
      this.logger.log(
        `Hoàn thành sinh TKB - Job: ${job.id}, Slots: ${result.totalSlots}`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      this.logger.error(
        `Sinh TKB thất bại - Job: ${job.id}, Error: ${errorMessage}`,
      );

      throw error;
    }
  }

  private async waitForCompletion(
    job: Job<TimetableGenerationJobData>,
    generationJobId: string,
  ): Promise<TimetableGenerationResult> {
    const maxAttempts = 60;
    const pollInterval = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = this.generatorService.getJobStatus(generationJobId);

      if (!status) {
        throw new Error(`Generation job ${generationJobId} không tìm thấy`);
      }

      if (status.status === 'completed') {
        return {
          jobId: generationJobId,
          status: 'completed',
          totalSlots: status.totalSlots,
          message: status.message ?? 'Hoàn thành',
        };
      }

      if (status.status === 'failed') {
        return {
          jobId: generationJobId,
          status: 'failed',
          totalSlots: 0,
          message: status.message ?? 'Thất bại',
        };
      }

      // Update progress based on internal job progress
      const progress = Math.min(30 + Math.round(status.progress * 0.6), 90);
      await job.updateProgress(progress);

      await this.delay(pollInterval);
    }

    throw new Error('Quá thời gian chờ sinh TKB');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
