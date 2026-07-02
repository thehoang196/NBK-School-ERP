import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RoomEntity } from './entities/room.entity';
import { RoomQueryDto } from './dto/room-query.dto';

@Injectable()
export class RoomRepository {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly repo: Repository<RoomEntity>,
  ) {}

  async findAll(query: RoomQueryDto): Promise<[RoomEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, roomType, status, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('room')
      .where('room.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('room.schoolId = :schoolId', { schoolId });
    }

    if (roomType) {
      queryBuilder.andWhere('room.roomType = :roomType', { roomType });
    }

    if (status) {
      queryBuilder.andWhere('room.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(room.name ILIKE :search OR room.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`room.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('room.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<RoomEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true },
    });
  }

  async create(data: Partial<RoomEntity>): Promise<RoomEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<RoomEntity>): Promise<RoomEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
