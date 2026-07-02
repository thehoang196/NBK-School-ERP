import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { ClassQueryDto } from '../dto/class-query.dto';

@Injectable()
export class ClassRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
  ) {}

  async findAll(query: ClassQueryDto): Promise<[ClassEntity[], number]> {
    const { page, limit, sortBy, sortOrder, schoolId, gradeId, academicYearId, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo.createQueryBuilder('class')
      .leftJoinAndSelect('class.grade', 'grade')
      .where('class.deletedAt IS NULL');

    if (schoolId) {
      queryBuilder.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    if (gradeId) {
      queryBuilder.andWhere('class.gradeId = :gradeId', { gradeId });
    }

    if (academicYearId) {
      queryBuilder.andWhere('class.academicYearId = :academicYearId', { academicYearId });
    }

    if (search) {
      queryBuilder.andWhere('class.name ILIKE :search', { search: `%${search}%` });
    }

    if (sortBy) {
      queryBuilder.orderBy(`class.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('class.name', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<ClassEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true, grade: true, academicYear: true },
    });
  }

  async findByNameInGradeAndYear(
    gradeId: string,
    academicYearId: string,
    name: string,
  ): Promise<ClassEntity | null> {
    return this.repo.findOne({
      where: { gradeId, academicYearId, name, deletedAt: IsNull() },
    });
  }

  async create(data: Partial<ClassEntity>): Promise<ClassEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<ClassEntity>): Promise<ClassEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
