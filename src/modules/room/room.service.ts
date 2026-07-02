import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomRepository } from './room.repository';
import { RoomEntity } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  async findAll(query: RoomQueryDto): Promise<PaginatedResponse<RoomEntity>> {
    const [data, total] = await this.roomRepository.findAll(query);
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

  async findById(id: string): Promise<RoomEntity> {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng học');
    }
    return room;
  }

  async create(dto: CreateRoomDto): Promise<RoomEntity> {
    return this.roomRepository.create(dto);
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomEntity> {
    await this.findById(id);
    const updated = await this.roomRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy phòng học');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.roomRepository.softDelete(id);
  }
}
