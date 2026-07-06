import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PayrollAdjustmentRepository } from '../repositories/payroll-adjustment.repository';
import { PayrollAdjustmentEntity } from '../entities/payroll-adjustment.entity';
import { PayComponentType } from '../enums';

export interface CreateAdjustmentDto {
  teacherId: string;
  originalPayPeriodId: string;
  appliedPayPeriodId?: string;
  type: PayComponentType;
  description: string;
  amount: number;
  reason: string;
}

@Injectable()
export class PayrollAdjustmentService {
  private readonly logger = new Logger(PayrollAdjustmentService.name);

  constructor(
    private readonly adjustmentRepo: PayrollAdjustmentRepository,
  ) {}

  async findAll(
    schoolId: string,
    options: { page: number; limit: number; teacherId?: string; payPeriodId?: string },
  ): Promise<{ items: PayrollAdjustmentEntity[]; total: number }> {
    const [items, total] = await this.adjustmentRepo.findAll(schoolId, options);
    return { items, total };
  }

  async findById(id: string, schoolId: string): Promise<PayrollAdjustmentEntity> {
    const adj = await this.adjustmentRepo.findById(id, schoolId);
    if (!adj) {
      throw new NotFoundException(`Không tìm thấy điều chỉnh lương với ID "${id}"`);
    }
    return adj;
  }

  async create(
    schoolId: string,
    dto: CreateAdjustmentDto,
    userId: string,
  ): Promise<PayrollAdjustmentEntity> {
    if (dto.amount === 0) {
      throw new BadRequestException('Số tiền điều chỉnh không được bằng 0');
    }

    return this.adjustmentRepo.create({
      schoolId,
      teacherId: dto.teacherId,
      originalPayPeriodId: dto.originalPayPeriodId,
      appliedPayPeriodId: dto.appliedPayPeriodId || null,
      type: dto.type,
      description: dto.description,
      amount: dto.amount,
      reason: dto.reason,
      isApplied: false,
      createdBy: userId,
    });
  }

  async approve(
    id: string,
    schoolId: string,
    userId: string,
  ): Promise<PayrollAdjustmentEntity> {
    const adj = await this.findById(id, schoolId);

    if (adj.approvedBy) {
      throw new BadRequestException('Điều chỉnh này đã được duyệt');
    }

    await this.adjustmentRepo.update(id, {
      approvedBy: userId,
      approvedAt: new Date(),
      updatedBy: userId,
    });

    return this.findById(id, schoolId);
  }

  /**
   * Lấy danh sách adjustment chưa áp dụng cho một kỳ lương.
   */
  async getUnappliedForPeriod(
    appliedPayPeriodId: string,
    schoolId: string,
  ): Promise<PayrollAdjustmentEntity[]> {
    return this.adjustmentRepo.findUnappliedByPeriod(
      appliedPayPeriodId,
      schoolId,
    );
  }

  /**
   * Đánh dấu đã áp dụng sau khi tính vào salary slip.
   */
  async markApplied(ids: string[], userId: string): Promise<void> {
    for (const id of ids) {
      await this.adjustmentRepo.update(id, {
        isApplied: true,
        updatedBy: userId,
      });
    }
  }
}
