import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PayrollInputSnapshotEntity } from '../entities/payroll-input-snapshot.entity';

export interface SnapshotInput {
  schoolId: string;
  teacherId: string;
  payrollRunId: string | null;
  payPeriodId: string;
  salarySlipId: string | null;
  attendanceDays: number;
  teachingHoursByType: Record<string, number> | null;
  variableValues: Record<string, number> | null;
  formulaVersionsUsed: Record<string, number> | null;
}

@Injectable()
export class PayrollSnapshotService {
  private readonly logger = new Logger(PayrollSnapshotService.name);

  constructor(
    @InjectRepository(PayrollInputSnapshotEntity)
    private readonly repo: Repository<PayrollInputSnapshotEntity>,
  ) {}

  /**
   * Tạo snapshot trước khi tính lương.
   */
  async createSnapshot(data: SnapshotInput): Promise<PayrollInputSnapshotEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  /**
   * Lấy snapshot theo salary slip ID.
   */
  async findBySalarySlip(salarySlipId: string): Promise<PayrollInputSnapshotEntity | null> {
    return this.repo.findOne({
      where: { salarySlipId, deletedAt: IsNull() },
    });
  }

  /**
   * Lấy snapshot theo teacher + pay period.
   */
  async findByTeacherAndPeriod(
    teacherId: string,
    payPeriodId: string,
  ): Promise<PayrollInputSnapshotEntity | null> {
    return this.repo.findOne({
      where: { teacherId, payPeriodId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lấy tất cả snapshots cho 1 payroll run.
   */
  async findByPayrollRun(payrollRunId: string): Promise<PayrollInputSnapshotEntity[]> {
    return this.repo.find({
      where: { payrollRunId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }
}
