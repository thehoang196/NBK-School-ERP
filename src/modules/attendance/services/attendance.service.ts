import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceRecordEntity } from '../entities/attendance-record.entity';
import {
  CreateAttendanceRecordDto,
  UpdateAttendanceRecordDto,
  AttendanceQueryDto,
  BulkCreateAttendanceDto,
} from '../dto';
import { AttendanceStatus } from '../enums';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly recordRepository: AttendanceRecordRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    schoolId: string,
    query: AttendanceQueryDto,
  ): Promise<{ items: AttendanceRecordEntity[]; total: number }> {
    const [items, total] = await this.recordRepository.findAll(schoolId, query);
    return { items, total };
  }

  async findById(
    id: string,
    schoolId: string,
  ): Promise<AttendanceRecordEntity> {
    const record = await this.recordRepository.findById(id, schoolId);
    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi chấm công với ID "${id}"`,
      );
    }
    return record;
  }

  async create(
    dto: CreateAttendanceRecordDto,
    schoolId: string,
    userId: string,
  ): Promise<AttendanceRecordEntity> {
    // Validate: không trùng teacher + ngày
    const existing = await this.recordRepository.findByTeacherAndDate(
      dto.teacherId,
      dto.workDate,
      schoolId,
    );

    if (existing) {
      throw new BadRequestException(
        `Giáo viên đã có bản ghi chấm công cho ngày ${dto.workDate}`,
      );
    }

    this.validateStatusLeaveType(dto.status, dto.leaveType);

    const record = await this.recordRepository.create({
      schoolId,
      teacherId: dto.teacherId,
      workDate: dto.workDate,
      checkIn: dto.checkIn || null,
      checkOut: dto.checkOut || null,
      status: dto.status,
      method: dto.method,
      leaveType: dto.leaveType || null,
      overtimeHours: dto.overtimeHours || 0,
      workCoefficient: dto.workCoefficient ?? this.getDefaultCoefficient(dto.status),
      note: dto.note || null,
      createdBy: userId,
    });

    this.eventEmitter.emit('attendance.created', {
      schoolId,
      teacherId: dto.teacherId,
      workDate: dto.workDate,
    });

    return record;
  }

  async bulkCreate(
    dto: BulkCreateAttendanceDto,
    schoolId: string,
    userId: string,
  ): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
    let successCount = 0;
    const errors: string[] = [];

    for (const record of dto.records) {
      try {
        await this.create(record, schoolId, userId);
        successCount++;
      } catch (error) {
        errors.push(
          `GV ${record.teacherId}, ngày ${record.workDate}: ${(error as Error).message}`,
        );
      }
    }

    return {
      successCount,
      errorCount: errors.length,
      errors,
    };
  }

  async update(
    id: string,
    dto: UpdateAttendanceRecordDto,
    schoolId: string,
    userId: string,
  ): Promise<AttendanceRecordEntity> {
    const existing = await this.findById(id, schoolId);

    if (dto.status !== undefined && dto.leaveType !== undefined) {
      this.validateStatusLeaveType(dto.status, dto.leaveType);
    }

    await this.recordRepository.update(id, {
      ...dto,
      workCoefficient:
        dto.workCoefficient ??
        (dto.status ? this.getDefaultCoefficient(dto.status) : undefined),
      updatedBy: userId,
    });

    this.eventEmitter.emit('attendance.updated', {
      schoolId,
      teacherId: existing.teacherId,
      workDate: existing.workDate,
    });

    return this.findById(id, schoolId);
  }

  async delete(id: string, schoolId: string): Promise<void> {
    const existing = await this.findById(id, schoolId);
    await this.recordRepository.softDelete(id);

    this.eventEmitter.emit('attendance.deleted', {
      schoolId,
      teacherId: existing.teacherId,
      workDate: existing.workDate,
    });
  }

  private validateStatusLeaveType(
    status: AttendanceStatus,
    leaveType?: LeaveType | null,
  ): void {
    if (
      (status === AttendanceStatus.LEAVE || status === AttendanceStatus.ABSENT) &&
      !leaveType
    ) {
      throw new BadRequestException(
        'Phải chỉ định loại nghỉ (leaveType) khi trạng thái là LEAVE hoặc ABSENT',
      );
    }
  }

  private getDefaultCoefficient(status: AttendanceStatus): number {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 1;
      case AttendanceStatus.LATE:
        return 1;
      case AttendanceStatus.HALF_DAY:
        return 0.5;
      case AttendanceStatus.LEAVE:
        return 0;
      case AttendanceStatus.ABSENT:
        return 0;
      default:
        return 1;
    }
  }
}

// Import LeaveType for internal use
import { LeaveType } from '../enums';
