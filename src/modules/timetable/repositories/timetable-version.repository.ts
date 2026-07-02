import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionQueryDto } from '../dto/timetable-query.dto';
import { TimetableStatus } from '../../../common/enums/status.enum';

@Injectable()
export class TimetableVersionRepository {
  constructor(
    @InjectRepository(TimetableVersionEntity)
    private readonly repo: Repository<TimetableVersionEntity>,
  ) {}

  async findAll(query: TimetableVersionQueryDto): Promise<[TimetableVersionEntity[], number]> {
    const { page, limit, semesterId, status } = query;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('tv')
      .where('tv.deletedAt IS NULL');

    if (semesterId) {
      qb.andWhere('tv.semester_id = :semesterId', { semesterId });
    }
    if (status) {
      qb.andWhere('tv.status = :status', { status });
    }

    qb.orderBy('tv.version_number', 'DESC')
      .skip(skip)
      .take(limit);

    return qb.getManyAndCount();
  }

  async findBySemester(semesterId: string): Promise<TimetableVersionEntity[]> {
    return this.repo.find({
      where: { semesterId, deletedAt: IsNull() },
      order: { versionNumber: 'DESC' },
    });
  }

  async findPublished(semesterId: string): Promise<TimetableVersionEntity | null> {
    return this.repo.findOne({
      where: {
        semesterId,
        status: TimetableStatus.PUBLISHED,
        deletedAt: IsNull(),
      },
      relations: { slots: true },
    });
  }

  async findById(id: string): Promise<TimetableVersionEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { semester: true },
    });
  }

  async findByIdWithSlots(id: string): Promise<TimetableVersionEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: {
        slots: {
          period: true,
          class: true,
          teacher: true,
          subject: true,
          room: true,
        },
      },
    });
  }

  async getNextVersionNumber(semesterId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('tv')
      .select('MAX(tv.version_number)', 'maxVersion')
      .where('tv.semester_id = :semesterId', { semesterId })
      .getRawOne();
    return (result?.maxVersion || 0) + 1;
  }

  async create(data: Partial<TimetableVersionEntity>): Promise<TimetableVersionEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<TimetableVersionEntity>): Promise<TimetableVersionEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async publish(id: string, userId: string): Promise<TimetableVersionEntity | null> {
    await this.repo.update(id, {
      status: TimetableStatus.PUBLISHED,
      publishedAt: new Date(),
      publishedBy: userId,
    });
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
