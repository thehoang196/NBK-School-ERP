import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PeriodSwapRepository } from '../repositories/period-swap.repository';
import { PeriodSwapEntity } from '../entities/period-swap.entity';
import { CreatePeriodSwapDto } from '../dto';
import { PeriodSwapStatus } from '../enums';

@Injectable()
export class PeriodSwapService {
  private readonly logger = new Logger(PeriodSwapService.name);

  constructor(
    private readonly swapRepo: PeriodSwapRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    schoolId: string,
    options: { page: number; limit: number; teacherId?: string; status?: PeriodSwapStatus },
  ): Promise<{ items: PeriodSwapEntity[]; total: number }> {
    const [items, total] = await this.swapRepo.findAll(schoolId, options);
    return { items, total };
  }

  async findById(id: string, schoolId: string): Promise<PeriodSwapEntity> {
    const swap = await this.swapRepo.findById(id, schoolId);
    if (!swap) {
      throw new NotFoundException(`Không tìm thấy yêu cầu đổi tiết với ID "${id}"`);
    }
    return swap;
  }

  /**
   * GV tạo yêu cầu đổi tiết.
   */
  async create(
    dto: CreatePeriodSwapDto,
    schoolId: string,
    requesterId: string,
  ): Promise<PeriodSwapEntity> {
    if (requesterId === dto.targetId) {
      throw new BadRequestException('Không thể đổi tiết với chính mình');
    }

    const swap = await this.swapRepo.create({
      schoolId,
      requesterId,
      targetId: dto.targetId,
      requesterDate: dto.requesterDate,
      requesterPeriod: dto.requesterPeriod,
      targetDate: dto.targetDate,
      targetPeriod: dto.targetPeriod,
      reason: dto.reason,
      status: PeriodSwapStatus.PENDING_TEACHER,
      createdBy: requesterId,
    });

    this.eventEmitter.emit('period-swap.created', {
      schoolId,
      requesterId,
      targetId: dto.targetId,
      swapId: swap.id,
    });

    return swap;
  }

  /**
   * GV target đồng ý đổi tiết → chuyển sang PENDING_ADMIN.
   */
  async acceptByTarget(
    id: string,
    schoolId: string,
    targetTeacherId: string,
  ): Promise<PeriodSwapEntity> {
    const swap = await this.findById(id, schoolId);

    if (swap.targetId !== targetTeacherId) {
      throw new BadRequestException('Bạn không phải giáo viên được đề nghị đổi tiết');
    }

    if (swap.status !== PeriodSwapStatus.PENDING_TEACHER) {
      throw new BadRequestException(
        `Không thể đồng ý. Trạng thái hiện tại: ${swap.status}`,
      );
    }

    await this.swapRepo.update(id, {
      status: PeriodSwapStatus.PENDING_ADMIN,
      targetAcceptedAt: new Date(),
      updatedBy: targetTeacherId,
    });

    this.eventEmitter.emit('period-swap.accepted-by-teacher', {
      schoolId,
      swapId: id,
    });

    return this.findById(id, schoolId);
  }

  /**
   * GV target từ chối.
   */
  async rejectByTarget(
    id: string,
    schoolId: string,
    targetTeacherId: string,
    reason: string,
  ): Promise<PeriodSwapEntity> {
    const swap = await this.findById(id, schoolId);

    if (swap.targetId !== targetTeacherId) {
      throw new BadRequestException('Bạn không phải giáo viên được đề nghị đổi tiết');
    }

    if (swap.status !== PeriodSwapStatus.PENDING_TEACHER) {
      throw new BadRequestException(
        `Không thể từ chối. Trạng thái hiện tại: ${swap.status}`,
      );
    }

    await this.swapRepo.update(id, {
      status: PeriodSwapStatus.REJECTED_BY_TEACHER,
      rejectionReason: reason,
      updatedBy: targetTeacherId,
    });

    return this.findById(id, schoolId);
  }

  /**
   * Admin duyệt yêu cầu đổi tiết → status = APPROVED.
   * Sau khi approve, cần emit event để cập nhật actual_timetable_slots.
   */
  async approveByAdmin(
    id: string,
    schoolId: string,
    adminId: string,
  ): Promise<PeriodSwapEntity> {
    const swap = await this.findById(id, schoolId);

    if (swap.status !== PeriodSwapStatus.PENDING_ADMIN) {
      throw new BadRequestException(
        `Chỉ có thể duyệt khi trạng thái PENDING_ADMIN. Hiện tại: ${swap.status}`,
      );
    }

    await this.swapRepo.update(id, {
      status: PeriodSwapStatus.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
      updatedBy: adminId,
    });

    this.eventEmitter.emit('period-swap.approved', {
      schoolId,
      swapId: id,
      requesterId: swap.requesterId,
      targetId: swap.targetId,
      requesterDate: swap.requesterDate,
      requesterPeriod: swap.requesterPeriod,
      targetDate: swap.targetDate,
      targetPeriod: swap.targetPeriod,
    });

    return this.findById(id, schoolId);
  }

  /**
   * Admin từ chối.
   */
  async rejectByAdmin(
    id: string,
    schoolId: string,
    adminId: string,
    reason: string,
  ): Promise<PeriodSwapEntity> {
    const swap = await this.findById(id, schoolId);

    if (swap.status !== PeriodSwapStatus.PENDING_ADMIN) {
      throw new BadRequestException(
        `Chỉ có thể từ chối khi trạng thái PENDING_ADMIN. Hiện tại: ${swap.status}`,
      );
    }

    await this.swapRepo.update(id, {
      status: PeriodSwapStatus.REJECTED_BY_ADMIN,
      rejectionReason: reason,
      approvedBy: adminId,
      approvedAt: new Date(),
      updatedBy: adminId,
    });

    return this.findById(id, schoolId);
  }

  /**
   * GV hủy yêu cầu (trước khi approved).
   */
  async cancel(
    id: string,
    schoolId: string,
    requesterId: string,
  ): Promise<PeriodSwapEntity> {
    const swap = await this.findById(id, schoolId);

    if (swap.requesterId !== requesterId) {
      throw new BadRequestException('Bạn không phải người tạo yêu cầu đổi tiết');
    }

    if (swap.status === PeriodSwapStatus.APPROVED) {
      throw new BadRequestException('Không thể hủy yêu cầu đã được duyệt');
    }

    await this.swapRepo.update(id, {
      status: PeriodSwapStatus.CANCELLED,
      updatedBy: requesterId,
    });

    return this.findById(id, schoolId);
  }
}
