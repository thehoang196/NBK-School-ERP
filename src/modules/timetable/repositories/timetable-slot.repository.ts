import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableSlotQueryDto } from '../dto/timetable-query.dto';

@Injectable()
export class TimetableSlotRepository {
  constructor(
    @InjectRepository(TimetableSlotEntity)
    private readonly repo: Repository<TimetableSlotEntity>,
  ) {}

  async findByQuery(
    query: TimetableSlotQueryDto,
  ): Promise<TimetableSlotEntity[]> {
    const qb = this.repo
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.period', 'period')
      .leftJoinAndSelect('slot.class', 'class')
      .leftJoinAndSelect('slot.teacher', 'teacher')
      .leftJoinAndSelect('slot.subject', 'subject')
      .leftJoinAndSelect('slot.room', 'room')
      .where('slot.deletedAt IS NULL');

    if (query.versionId) {
      qb.andWhere('slot.version_id = :versionId', {
        versionId: query.versionId,
      });
    }
    if (query.classId) {
      qb.andWhere('slot.class_id = :classId', { classId: query.classId });
    }
    if (query.teacherId) {
      qb.andWhere('slot.teacher_id = :teacherId', {
        teacherId: query.teacherId,
      });
    }
    if (query.roomId) {
      qb.andWhere('slot.room_id = :roomId', { roomId: query.roomId });
    }

    qb.orderBy('slot.day_of_week', 'ASC').addOrderBy(
      'period.period_number',
      'ASC',
    );

    return qb.getMany();
  }

  async findById(id: string): Promise<TimetableSlotEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: {
        period: true,
        class: true,
        teacher: true,
        subject: true,
        room: true,
      },
    });
  }

  async findByVersion(versionId: string): Promise<TimetableSlotEntity[]> {
    return this.repo.find({
      where: { versionId, deletedAt: IsNull() },
      relations: {
        period: true,
        class: true,
        teacher: true,
        subject: true,
        room: true,
      },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async findConflicts(params: {
    dayOfWeek: number;
    periodId: string;
    versionId: string;
    excludeId?: string;
  }): Promise<TimetableSlotEntity[]> {
    const { dayOfWeek, periodId, versionId, excludeId } = params;
    const qb = this.repo
      .createQueryBuilder('slot')
      .where('slot.version_id = :versionId', { versionId })
      .andWhere('slot.day_of_week = :dayOfWeek', { dayOfWeek })
      .andWhere('slot.period_id = :periodId', { periodId })
      .andWhere('slot.deletedAt IS NULL');

    if (excludeId) {
      qb.andWhere('slot.id != :excludeId', { excludeId });
    }

    return qb.getMany();
  }

  async findByTeacher(
    teacherId: string,
    versionId: string,
  ): Promise<TimetableSlotEntity[]> {
    return this.repo.find({
      where: { teacherId, versionId, deletedAt: IsNull() },
      relations: {
        period: true,
        class: true,
        teacher: true,
        subject: true,
        room: true,
      },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async findByClass(
    classId: string,
    versionId: string,
  ): Promise<TimetableSlotEntity[]> {
    return this.repo.find({
      where: { classId, versionId, deletedAt: IsNull() },
      relations: {
        period: true,
        class: true,
        teacher: true,
        subject: true,
        room: true,
      },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async findByRoom(
    roomId: string,
    versionId: string,
  ): Promise<TimetableSlotEntity[]> {
    return this.repo.find({
      where: { roomId, versionId, deletedAt: IsNull() },
      relations: {
        period: true,
        class: true,
        teacher: true,
        subject: true,
        room: true,
      },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async create(
    data: Partial<TimetableSlotEntity>,
  ): Promise<TimetableSlotEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async createMany(
    data: Partial<TimetableSlotEntity>[],
  ): Promise<TimetableSlotEntity[]> {
    const entities = this.repo.create(data);
    return this.repo.save(entities);
  }

  async update(
    id: string,
    data: Partial<TimetableSlotEntity>,
  ): Promise<TimetableSlotEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async deleteByVersion(versionId: string): Promise<void> {
    await this.repo.softDelete({ versionId });
  }

  /**
   * Find all slots for a teacher across multiple timetable versions.
   * Used by cross-school conflict detection to get busy slots from other schools.
   */
  async findCrossSchoolSlots(
    teacherId: string,
    versionIds: string[],
  ): Promise<TimetableSlotEntity[]> {
    if (versionIds.length === 0) {
      return [];
    }

    return this.repo.find({
      where: {
        teacherId,
        versionId: In(versionIds),
        deletedAt: IsNull(),
      },
      select: ['id', 'dayOfWeek', 'periodId', 'versionId', 'schoolId'],
    });
  }
}
