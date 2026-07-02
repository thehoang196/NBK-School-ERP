import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherQueryDto } from './dto/teacher-query.dto';

@Injectable()
export class TeacherRepository {
  constructor(
    @InjectRepository(TeacherEntity)
    private readonly repo: Repository<TeacherEntity>,
  ) {}

  async findAll(query: TeacherQueryDto): Promise<[TeacherEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, gradeId, departmentId, status, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.grade', 'grade')
      .leftJoinAndSelect('teacher.department', 'department')
      .where('teacher.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('teacher.schoolId = :schoolId', { schoolId });
    }

    if (gradeId) {
      queryBuilder.andWhere('teacher.gradeId = :gradeId', { gradeId });
    }

    if (departmentId) {
      queryBuilder.andWhere('teacher.departmentId = :departmentId', { departmentId });
    }

    if (status) {
      queryBuilder.andWhere('teacher.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(teacher.fullName ILIKE :search OR teacher.employeeCode ILIKE :search OR teacher.citizenId ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`teacher.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('teacher.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<TeacherEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true, grade: true, department: true },
    });
  }

  async create(data: Partial<TeacherEntity>): Promise<TeacherEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<TeacherEntity>): Promise<TeacherEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
