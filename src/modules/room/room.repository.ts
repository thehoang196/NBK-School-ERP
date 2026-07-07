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

  async findBySchool(schoolId: string): Promise<RoomEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(
    query: RoomQueryDto,
    schoolId: string,
  ): Promise<[RoomEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      roomType,
      status,
      building,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('room')
      .where('room.deletedAt IS NULL');

    // SUPER_ADMIN: schoolId rỗng → không filter, trả tất cả
    if (schoolId) {
      queryBuilder.andWhere('room.schoolId = :schoolId', { schoolId });
    }

    if (roomType) {
      queryBuilder.andWhere('room.roomType = :roomType', { roomType });
    }

    if (status) {
      queryBuilder.andWhere('room.status = :status', { status });
    }

    if (building) {
      queryBuilder.andWhere('room.building = :building', { building });
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

  async findById(id: string, schoolId: string): Promise<RoomEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
    });
  }

  async findByCode(code: string, schoolId: string): Promise<RoomEntity | null> {
    return this.repo.findOne({
      where: { code, schoolId, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<RoomEntity>): Promise<RoomEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    schoolId: string,
    data: Partial<RoomEntity>,
  ): Promise<RoomEntity | null> {
    await this.repo.update({ id, schoolId, deletedAt: IsNull() }, data);
    return this.findById(id, schoolId);
  }

  async softDelete(id: string, schoolId: string): Promise<void> {
    await this.repo.softDelete({ id, schoolId });
  }
}
