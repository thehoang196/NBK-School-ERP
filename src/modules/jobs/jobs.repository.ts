import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { JobRecordEntity, JobStatus } from './entities/job-record.entity';
import { JobQueryDto } from './dto/job-query.dto';

@Injectable()
export class JobsRepository {
  constructor(
    @InjectRepository(JobRecordEntity)
    private readonly repo: Repository<JobRecordEntity>,
  ) {}

  async create(data: Partial<JobRecordEntity>): Promise<JobRecordEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<JobRecordEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAll(
    query: JobQueryDto,
    schoolId: string | null,
  ): Promise<[JobRecordEntity[], number]> {
    const where: FindOptionsWhere<JobRecordEntity> = {};

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.jobType) {
      where.jobType = query.jobType;
    }

    return this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    extra?: Partial<Pick<JobRecordEntity, 'startedAt' | 'completedAt' | 'progress' | 'result' | 'errorMessage' | 'bullJobId'>>,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status, ...extra };
    await this.repo.update(id, updateData);
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    await this.repo.update(id, { progress });
  }
}
