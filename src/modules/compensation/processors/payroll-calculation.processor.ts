import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CalculationService, TeacherData } from '../services/calculation.service';
import { PayrollRunService } from '../services/payroll-run.service';

export interface PayrollCalculationJobData {
  schoolId: string;
  payPeriodId: string;
  payrollRunId: string;
  teacherDataList: TeacherData[];
}

@Processor('payroll-calculation')
export class PayrollCalculationProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollCalculationProcessor.name);

  private static readonly CHUNK_SIZE = 50;

  constructor(
    private readonly calculationService: CalculationService,
    private readonly payrollRunService: PayrollRunService,
  ) {
    super();
  }

  async process(job: Job<PayrollCalculationJobData>): Promise<void> {
    const { schoolId, payPeriodId, payrollRunId, teacherDataList } = job.data;

    this.logger.log(
      `Bắt đầu tính lương batch: payrollRunId=${payrollRunId}, ${teacherDataList.length} GV`,
    );

    const chunks = this.chunkArray(teacherDataList, PayrollCalculationProcessor.CHUNK_SIZE);

    let totalGross = 0;
    let totalNet = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.logger.log(
        `Processing chunk ${i + 1}/${chunks.length} (${chunk.length} GV)`,
      );

      try {
        const summary = await this.calculationService.calculate(
          { schoolId, payPeriodId },
          chunk,
        );

        totalGross += summary.totalGross;
        totalNet += summary.totalNet;
        successCount += summary.successCount;
        errorCount += summary.errorCount;

        // Update progress
        await job.updateProgress(
          Math.round(((i + 1) / chunks.length) * 100),
        );
      } catch (error) {
        this.logger.error(
          `Lỗi chunk ${i + 1}: ${(error as Error).message}`,
        );
        errorCount += chunk.length;
      }
    }

    // Update payroll run totals
    await this.payrollRunService.updateTotals(payrollRunId, {
      totalTeachers: teacherDataList.length,
      successCount,
      errorCount,
      totalGross,
      totalNet,
    });

    this.logger.log(
      `Hoàn thành tính lương batch: ${successCount} thành công, ${errorCount} lỗi`,
    );
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
