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

  async findBySchool(schoolId: string): Promise<TeacherEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      relations: { grade: true, department: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(
    query: TeacherQueryDto,
    schoolId: string,
  ): Promise<[TeacherEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      departmentId,
      status,
      teacherType,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.grade', 'grade')
      .leftJoinAndSelect('teacher.department', 'department')
      .where('teacher.deletedAt IS NULL')
      .andWhere('teacher.schoolId = :schoolId', { schoolId });

    if (departmentId) {
      queryBuilder.andWhere('teacher.departmentId = :departmentId', {
        departmentId,
      });
    }

    if (status) {
      queryBuilder.andWhere('teacher.status = :status', { status });
    }

    if (teacherType) {
      queryBuilder.andWhere('teacher.teacherType = :teacherType', {
        teacherType,
      });
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

  async findById(id: string, schoolId: string): Promise<TeacherEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
      relations: { school: true, grade: true, department: true },
    });
  }

  /**
   * Internal lookup without schoolId scope — used by cross-module services
   * that need to validate teacher existence before knowing the school context.
   */
  async findByIdInternal(id: string): Promise<TeacherEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true, grade: true, department: true },
    });
  }

  async findByEmployeeCode(
    employeeCode: string,
    schoolId: string,
  ): Promise<TeacherEntity | null> {
    return this.repo.findOne({
      where: { employeeCode, schoolId, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<TeacherEntity>): Promise<TeacherEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    schoolId: string,
    data: Partial<TeacherEntity>,
  ): Promise<TeacherEntity | null> {
    await this.repo.update({ id, schoolId, deletedAt: IsNull() }, data);
    return this.findById(id, schoolId);
  }

  async softDelete(id: string, schoolId: string): Promise<void> {
    await this.repo.softDelete({ id, schoolId });
  }
}
