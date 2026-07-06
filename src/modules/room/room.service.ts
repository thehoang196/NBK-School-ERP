import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomRepository } from './room.repository';
import { RoomEntity } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';
import { DuplicateRoomCodeException } from './exceptions/duplicate-room-code.exception';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  async findAll(
    query: RoomQueryDto,
    schoolId: string,
  ): Promise<PaginatedResponse<RoomEntity>> {
    const [data, total] = await this.roomRepository.findAll(query, schoolId);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách phòng học thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string, schoolId: string): Promise<RoomEntity> {
    const room = await this.roomRepository.findById(id, schoolId);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng học');
    }
    return room;
  }

  async create(dto: CreateRoomDto, schoolId: string): Promise<RoomEntity> {
    const existing = await this.roomRepository.findByCode(dto.code, schoolId);
    if (existing) {
      throw new DuplicateRoomCodeException(dto.code);
    }
    return this.roomRepository.create({
      ...dto,
      schoolId,
    });
  }

  async update(
    id: string,
    schoolId: string,
    dto: UpdateRoomDto,
  ): Promise<RoomEntity> {
    await this.findById(id, schoolId);

    if (dto.code) {
      const existing = await this.roomRepository.findByCode(dto.code, schoolId);
      if (existing && existing.id !== id) {
        throw new DuplicateRoomCodeException(dto.code);
      }
    }

    const updated = await this.roomRepository.update(id, schoolId, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy phòng học');
    }
    return updated;
  }

  async remove(id: string, schoolId: string): Promise<void> {
    await this.findById(id, schoolId);
    await this.roomRepository.softDelete(id, schoolId);
  }
}
