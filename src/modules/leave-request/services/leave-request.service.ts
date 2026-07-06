import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveRequestRepository } from '../repositories/leave-request.repository';
import { LeaveRequestEntity } from '../entities/leave-request.entity';
import { CreateLeaveRequestDto, LeaveRequestQueryDto } from '../dto';
import { LeaveRequestStatus } from '../enums';

@Injectable()
export class LeaveRequestService {
  private readonly logger = new Logger(LeaveRequestService.name);

  constructor(
    private readonly leaveRequestRepo: LeaveRequestRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    schoolId: string,
    query: LeaveRequestQueryDto,
  ): Promise<{ items: LeaveRequestEntity[]; total: number }> {
    const [items, total] = await this.leaveRequestRepo.findAll(schoolId, query);
    return { items, total };
  }

  async findById(id: string, schoolId: string): Promise<LeaveRequestEntity> {
    const request = await this.leaveRequestRepo.findById(id, schoolId);
    if (!request) {
      throw new NotFoundException(`Không tìm thấy đơn xin nghỉ với ID "${id}"`);
    }
    return request;
  }

  /**
   * Giáo viên tạo đơn xin nghỉ.
   */
  async create(
    dto: CreateLeaveRequestDto,
    schoolId: string,
    teacherId: string,
  ): Promise<LeaveRequestEntity> {
    // Validate date range
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
    }

    // Check overlapping requests
    const overlapping = await this.leaveRequestRepo.findByTeacherAndDateRange(
      teacherId,
      schoolId,
      dto.startDate,
      dto.endDate,
    );

    if (overlapping.length > 0) {
      throw new BadRequestException(
        `Đã có đơn nghỉ trong khoảng thời gian ${dto.startDate} - ${dto.endDate}`,
      );
    }

    const request = await this.leaveRequestRepo.create({
      schoolId,
      teacherId,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalDays: dto.totalDays,
      reason: dto.reason,
      status: LeaveRequestStatus.PENDING,
      createdBy: teacherId,
    });

    this.eventEmitter.emit('leave-request.created', {
      schoolId,
      teacherId,
      requestId: request.id,
    });

    return request;
  }

  /**
   * Admin/BGH duyệt đơn nghỉ.
   */
  async approve(
    id: string,
    schoolId: string,
    approvedBy: string,
    adminNote?: string,
  ): Promise<LeaveRequestEntity> {
    const request = await this.findById(id, schoolId);

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(
        `Chỉ có thể duyệt đơn đang chờ. Trạng thái hiện tại: ${request.status}`,
      );
    }

    await this.leaveRequestRepo.update(id, {
      status: LeaveRequestStatus.APPROVED,
      approvedBy,
      approvedAt: new Date(),
      adminNote: adminNote || null,
      updatedBy: approvedBy,
    });

    this.eventEmitter.emit('leave-request.approved', {
      schoolId,
      teacherId: request.teacherId,
      requestId: id,
      startDate: request.startDate,
      endDate: request.endDate,
    });

    return this.findById(id, schoolId);
  }

  /**
   * Admin/BGH từ chối đơn nghỉ.
   */
  async reject(
    id: string,
    schoolId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<LeaveRequestEntity> {
    const request = await this.findById(id, schoolId);

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(
        `Chỉ có thể từ chối đơn đang chờ. Trạng thái hiện tại: ${request.status}`,
      );
    }

    await this.leaveRequestRepo.update(id, {
      status: LeaveRequestStatus.REJECTED,
      rejectionReason: reason,
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      updatedBy: rejectedBy,
    });

    this.eventEmitter.emit('leave-request.rejected', {
      schoolId,
      teacherId: request.teacherId,
      requestId: id,
    });

    return this.findById(id, schoolId);
  }

  /**
   * Giáo viên hủy đơn (chỉ khi đang PENDING).
   */
  async cancel(
    id: string,
    schoolId: string,
    teacherId: string,
  ): Promise<LeaveRequestEntity> {
    const request = await this.findById(id, schoolId);

    if (request.teacherId !== teacherId) {
      throw new BadRequestException('Bạn không có quyền hủy đơn này');
    }

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể hủy đơn đang chờ duyệt');
    }

    await this.leaveRequestRepo.update(id, {
      status: LeaveRequestStatus.CANCELLED,
      updatedBy: teacherId,
    });

    return this.findById(id, schoolId);
  }
}
