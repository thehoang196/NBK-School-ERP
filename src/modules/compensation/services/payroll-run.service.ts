import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollApprovalRepository } from '../repositories/payroll-approval.repository';
import { PayrollRunEntity } from '../entities/payroll-run.entity';
import { PayrollRunStatus, ApprovalAction } from '../enums';

/**
 * Payroll Run Service — quản lý vòng đời payroll run.
 * State machine: DRAFT → REVIEWED → APPROVED → PAID
 *                            ↘ REJECTED
 */
@Injectable()
export class PayrollRunService {
  private readonly logger = new Logger(PayrollRunService.name);

  /** Valid transitions map */
  private readonly transitions: Record<PayrollRunStatus, PayrollRunStatus[]> = {
    [PayrollRunStatus.DRAFT]: [PayrollRunStatus.REVIEWED, PayrollRunStatus.REJECTED],
    [PayrollRunStatus.REVIEWED]: [PayrollRunStatus.APPROVED, PayrollRunStatus.REJECTED],
    [PayrollRunStatus.APPROVED]: [PayrollRunStatus.PAID],
    [PayrollRunStatus.PAID]: [],
    [PayrollRunStatus.REJECTED]: [PayrollRunStatus.DRAFT],
  };

  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly approvalRepository: PayrollApprovalRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    schoolId: string,
    options: { page: number; limit: number; payPeriodId?: string; status?: PayrollRunStatus },
  ): Promise<{ items: PayrollRunEntity[]; total: number }> {
    const [items, total] = await this.payrollRunRepository.findAll(schoolId, options);
    return { items, total };
  }

  async findById(id: string, schoolId: string): Promise<PayrollRunEntity> {
    const run = await this.payrollRunRepository.findById(id, schoolId);
    if (!run) {
      throw new NotFoundException(`Không tìm thấy payroll run với ID "${id}"`);
    }
    return run;
  }

  async create(
    schoolId: string,
    data: { payPeriodId: string; name: string; note?: string },
    userId: string,
  ): Promise<PayrollRunEntity> {
    return this.payrollRunRepository.create({
      schoolId,
      payPeriodId: data.payPeriodId,
      name: data.name,
      status: PayrollRunStatus.DRAFT,
      note: data.note || null,
      createdBy: userId,
    });
  }

  /**
   * Submit for review: DRAFT → REVIEWED
   */
  async submitForReview(
    id: string,
    schoolId: string,
    userId: string,
    comment?: string,
  ): Promise<PayrollRunEntity> {
    return this.transition(
      id,
      schoolId,
      PayrollRunStatus.REVIEWED,
      ApprovalAction.SUBMIT_FOR_REVIEW,
      userId,
      comment,
    );
  }

  /**
   * Approve: REVIEWED → APPROVED
   */
  async approve(
    id: string,
    schoolId: string,
    userId: string,
    comment?: string,
  ): Promise<PayrollRunEntity> {
    return this.transition(
      id,
      schoolId,
      PayrollRunStatus.APPROVED,
      ApprovalAction.APPROVE,
      userId,
      comment,
    );
  }

  /**
   * Reject: DRAFT/REVIEWED → REJECTED
   */
  async reject(
    id: string,
    schoolId: string,
    userId: string,
    reason: string,
  ): Promise<PayrollRunEntity> {
    const run = await this.findById(id, schoolId);
    this.validateTransition(run.status, PayrollRunStatus.REJECTED);

    await this.payrollRunRepository.update(id, {
      status: PayrollRunStatus.REJECTED,
      rejectionReason: reason,
      updatedBy: userId,
    });

    await this.approvalRepository.create({
      schoolId,
      payrollRunId: id,
      action: ApprovalAction.REJECT,
      fromStatus: run.status,
      toStatus: PayrollRunStatus.REJECTED,
      performedBy: userId,
      comment: reason,
      createdBy: userId,
    });

    this.eventEmitter.emit('payroll-run.rejected', { schoolId, payrollRunId: id, reason });
    return this.findById(id, schoolId);
  }

  /**
   * Mark as Paid: APPROVED → PAID
   */
  async markPaid(
    id: string,
    schoolId: string,
    userId: string,
    comment?: string,
  ): Promise<PayrollRunEntity> {
    const run = await this.findById(id, schoolId);
    this.validateTransition(run.status, PayrollRunStatus.PAID);

    await this.payrollRunRepository.update(id, {
      status: PayrollRunStatus.PAID,
      paidAt: new Date(),
      updatedBy: userId,
    });

    await this.approvalRepository.create({
      schoolId,
      payrollRunId: id,
      action: ApprovalAction.MARK_PAID,
      fromStatus: run.status,
      toStatus: PayrollRunStatus.PAID,
      performedBy: userId,
      comment: comment || null,
      createdBy: userId,
    });

    this.eventEmitter.emit('payroll-run.paid', { schoolId, payrollRunId: id });
    return this.findById(id, schoolId);
  }

  /**
   * Reopen rejected run: REJECTED → DRAFT
   */
  async reopen(
    id: string,
    schoolId: string,
    userId: string,
  ): Promise<PayrollRunEntity> {
    const run = await this.findById(id, schoolId);
    if (run.status !== PayrollRunStatus.REJECTED) {
      throw new BadRequestException('Chỉ có thể mở lại payroll run đã bị từ chối');
    }

    await this.payrollRunRepository.update(id, {
      status: PayrollRunStatus.DRAFT,
      rejectionReason: null,
      updatedBy: userId,
    });

    return this.findById(id, schoolId);
  }

  /**
   * Get approval history for a run
   */
  async getApprovalHistory(payrollRunId: string) {
    return this.approvalRepository.findByPayrollRun(payrollRunId);
  }

  /**
   * Update run totals after calculation
   */
  async updateTotals(
    id: string,
    totals: {
      totalTeachers: number;
      successCount: number;
      errorCount: number;
      totalGross: number;
      totalNet: number;
    },
  ): Promise<void> {
    await this.payrollRunRepository.update(id, totals);
  }

  // ─── PRIVATE ─────────────────────────────────────────────────────────────

  private async transition(
    id: string,
    schoolId: string,
    toStatus: PayrollRunStatus,
    action: ApprovalAction,
    userId: string,
    comment?: string,
  ): Promise<PayrollRunEntity> {
    const run = await this.findById(id, schoolId);
    this.validateTransition(run.status, toStatus);

    const updateData: Partial<PayrollRunEntity> = {
      status: toStatus,
      updatedBy: userId,
    };

    // Set specific timestamp fields
    if (toStatus === PayrollRunStatus.REVIEWED) {
      updateData.submittedBy = userId;
      updateData.submittedAt = new Date();
    } else if (toStatus === PayrollRunStatus.APPROVED) {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }

    await this.payrollRunRepository.update(id, updateData);

    await this.approvalRepository.create({
      schoolId,
      payrollRunId: id,
      action,
      fromStatus: run.status,
      toStatus,
      performedBy: userId,
      comment: comment || null,
      createdBy: userId,
    });

    this.eventEmitter.emit(`payroll-run.${toStatus}`, { schoolId, payrollRunId: id });
    return this.findById(id, schoolId);
  }

  private validateTransition(
    currentStatus: PayrollRunStatus,
    targetStatus: PayrollRunStatus,
  ): void {
    const allowed = this.transitions[currentStatus];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ "${currentStatus}" sang "${targetStatus}". ` +
          `Trạng thái hợp lệ tiếp theo: ${allowed.join(', ') || 'không có'}`,
      );
    }
  }
}
