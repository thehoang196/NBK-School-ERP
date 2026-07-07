import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Not, Repository } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { ClassQueryDto } from '../dto/class-query.dto';

@Injectable()
export class ClassRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
  ) {}

  async findBySchool(schoolId: string): Promise<ClassEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findByGradeAndYear(
    gradeId: string,
    academicYearId: string,
    schoolId: string,
  ): Promise<ClassEntity[]> {
    return this.repo.find({
      where: { gradeId, academicYearId, schoolId, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findAll(
    query: ClassQueryDto,
    schoolId: string,
  ): Promise<[ClassEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      gradeId,
      academicYearId,
      status,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.grade', 'grade')
      .leftJoinAndSelect('class.school', 'school')
      .where('class.deletedAt IS NULL');

    // SUPER_ADMIN: schoolId rỗng → không filter, trả tất cả
    if (schoolId) {
      queryBuilder.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    if (gradeId) {
      queryBuilder.andWhere('class.gradeId = :gradeId', { gradeId });
    }

    if (academicYearId) {
      queryBuilder.andWhere('class.academicYearId = :academicYearId', {
        academicYearId,
      });
    }

    if (status) {
      queryBuilder.andWhere('class.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('class.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (sortBy) {
      queryBuilder.orderBy(`class.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('class.name', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string, schoolId?: string): Promise<ClassEntity | null> {
    const where: FindOptionsWhere<ClassEntity> = { id, deletedAt: IsNull() };
    if (schoolId) {
      where.schoolId = schoolId;
    }
    return this.repo.findOne({
      where,
      relations: { school: true, grade: true, academicYear: true },
    });
  }

  async findByNameGradeYear(
    name: string,
    gradeId: string,
    academicYearId: string,
    schoolId: string,
    excludeId?: string,
  ): Promise<ClassEntity | null> {
    const where: FindOptionsWhere<ClassEntity> = {
      name,
      gradeId,
      academicYearId,
      schoolId,
      deletedAt: IsNull(),
    };

    if (excludeId) {
      where.id = Not(excludeId);
    }

    return this.repo.findOne({ where });
  }

  async create(data: Partial<ClassEntity>): Promise<ClassEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<ClassEntity>,
  ): Promise<ClassEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id, data.schoolId);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
