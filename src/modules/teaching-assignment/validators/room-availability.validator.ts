import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RoomEntity } from '../../room/entities/room.entity';

export interface RoomAvailabilityValidationResult {
  valid: boolean;
  message?: string;
  roomId: string;
  capacity?: number;
  requiredCapacity?: number;
}

/**
 * RoomAvailabilityValidator — Kiểm tra phòng học có khả dụng và đủ sức chứa.
 *
 * Quy tắc:
 * - Phòng học PHẢI tồn tại và chưa bị xoá
 * - Phòng học PHẢI thuộc cùng school (tenant)
 * - Sức chứa phòng PHẢI >= số học sinh yêu cầu (nếu có)
 */
@Injectable()
export class RoomAvailabilityValidator {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,
  ) {}

  async validate(
    roomId: string,
    schoolId: string,
    requiredCapacity?: number,
  ): Promise<RoomAvailabilityValidationResult> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId, deletedAt: IsNull() },
    });

    if (!room) {
      return {
        valid: false,
        message: 'Không tìm thấy phòng học',
        roomId,
      };
    }

    // Kiểm tra tenant scope
    if (room.schoolId !== schoolId) {
      return {
        valid: false,
        message: 'Phòng học không thuộc trường này',
        roomId,
      };
    }

    // Kiểm tra sức chứa nếu có yêu cầu
    if (requiredCapacity && room.capacity && room.capacity < requiredCapacity) {
      return {
        valid: false,
        message: `Phòng ${room.name} không đủ sức chứa. Sức chứa: ${room.capacity}, yêu cầu: ${requiredCapacity}.`,
        roomId,
        capacity: room.capacity,
        requiredCapacity,
      };
    }

    return {
      valid: true,
      roomId,
      capacity: room.capacity ?? undefined,
    };
  }
}
