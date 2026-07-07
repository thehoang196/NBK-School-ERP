import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TeachingAssignmentEntity } from './entities/teaching-assignment.entity';
import { TeachingAssignmentQueryDto } from './dto/teaching-assignment-query.dto';

@Injectable()
export class TeachingAssignmentRepository {
  constructor(
    @InjectRepository(TeachingAssignmentEntity)
    private readonly repo: Repository<TeachingAssignmentEntity>,
  ) {}

  async findAll(
    query: TeachingAssignmentQueryDto,
  ): Promise<[TeachingAssignmentEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      schoolId,
      semesterId,
      teacherId,
      classId,
      subjectId,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('ta')
      .leftJoinAndSelect('ta.semester', 'semester')
      .leftJoinAndSelect('ta.teacher', 'teacher')
      .leftJoinAndSelect('ta.class', 'class')
      .leftJoinAndSelect('ta.subject', 'subject')
      .where('ta.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('ta.school_id = :schoolId', { schoolId });
    }

    if (semesterId) {
      queryBuilder.andWhere('ta.semester_id = :semesterId', { semesterId });
    }

    if (teacherId) {
      queryBuilder.andWhere('ta.teacher_id = :teacherId', { teacherId });
    }

    if (classId) {
      queryBuilder.andWhere('ta.class_id = :classId', { classId });
    }

    if (subjectId) {
      queryBuilder.andWhere('ta.subject_id = :subjectId', { subjectId });
    }

    if (sortBy) {
      queryBuilder.orderBy(`ta.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('ta.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<TeachingAssignmentEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { semester: true, teacher: true, class: true, subject: true },
    });
  }

  async findBySemester(
    semesterId: string,
  ): Promise<TeachingAssignmentEntity[]> {
    return this.repo.find({
      where: { semesterId, deletedAt: IsNull() },
      relations: { teacher: true, class: true, subject: true },
    });
  }

  async findByTeacher(
    teacherId: string,
    semesterId?: string,
  ): Promise<TeachingAssignmentEntity[]> {
    const where: Record<string, unknown> = { teacherId, deletedAt: IsNull() };
    if (semesterId) {
      where.semesterId = semesterId;
    }
    return this.repo.find({
      where,
      relations: { semester: true, class: true, subject: true },
    });
  }

  async sumPeriodsByTeacher(
    teacherId: string,
    semesterId: string,
  ): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('ta')
      .select('COALESCE(SUM(ta.periods_per_week), 0)', 'total')
      .where('ta.teacher_id = :teacherId', { teacherId })
      .andWhere('ta.semester_id = :semesterId', { semesterId })
      .andWhere('ta.deletedAt IS NULL')
      .getRawOne();

    return parseInt(result.total, 10);
  }

  async checkDuplicate(
    semesterId: string,
    teacherId: string,
    classId: string,
    subjectId: string,
    excludeId?: string,
  ): Promise<TeachingAssignmentEntity | null> {
    const queryBuilder = this.repo
      .createQueryBuilder('ta')
      .where('ta.semester_id = :semesterId', { semesterId })
      .andWhere('ta.teacher_id = :teacherId', { teacherId })
      .andWhere('ta.class_id = :classId', { classId })
      .andWhere('ta.subject_id = :subjectId', { subjectId })
      .andWhere('ta.deletedAt IS NULL');

    if (excludeId) {
      queryBuilder.andWhere('ta.id != :excludeId', { excludeId });
    }

    return queryBuilder.getOne();
  }

  async create(
    data: Partial<TeachingAssignmentEntity>,
  ): Promise<TeachingAssignmentEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<TeachingAssignmentEntity>,
  ): Promise<TeachingAssignmentEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  getRepository(): Repository<TeachingAssignmentEntity> {
    return this.repo;
  }
}
