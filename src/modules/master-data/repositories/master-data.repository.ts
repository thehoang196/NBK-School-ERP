import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EmployeeMasterEntity } from '../entities/employee-master.entity';
import { EmployeeMasterQueryDto } from '../dto/employee-master-query.dto';

@Injectable()
export class MasterDataRepository {
  constructor(
    @InjectRepository(EmployeeMasterEntity)
    private readonly repo: Repository<EmployeeMasterEntity>,
  ) {}

  async findAll(
    query: EmployeeMasterQueryDto,
  ): Promise<[EmployeeMasterEntity[], number]> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      schoolId,
      campusName,
      gradeName,
      departmentName,
      jobTitle,
      gender,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('em')
      .where('em.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(em.employee_code ILIKE :search OR em.full_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (schoolId) {
      queryBuilder.andWhere('em.school_id = :schoolId', { schoolId });
    }

    if (campusName) {
      queryBuilder.andWhere('em.campus_name = :campusName', { campusName });
    }

    if (gradeName) {
      queryBuilder.andWhere('em.grade_name = :gradeName', { gradeName });
    }

    if (departmentName) {
      queryBuilder.andWhere('em.department_name = :departmentName', {
        departmentName,
      });
    }

    if (jobTitle) {
      queryBuilder.andWhere('em.job_title = :jobTitle', { jobTitle });
    }

    if (gender) {
      queryBuilder.andWhere('em.gender = :gender', { gender });
    }

    if (query.extendedFieldFilters) {
      for (const [key, value] of Object.entries(query.extendedFieldFilters)) {
        queryBuilder.andWhere(
          `em.extended_fields->>'${key}' = :extFilter_${key}`,
          { [`extFilter_${key}`]: value },
        );
      }
    }

    if (sortBy) {
      queryBuilder.orderBy(`em.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('em.created_at', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<EmployeeMasterEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async findByEmployeeCode(
    schoolId: string,
    employeeCode: string,
  ): Promise<EmployeeMasterEntity | null> {
    return this.repo.findOne({
      where: { schoolId, employeeCode, deletedAt: IsNull() },
    });
  }

  async create(
    data: Partial<EmployeeMasterEntity>,
  ): Promise<EmployeeMasterEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<EmployeeMasterEntity>,
  ): Promise<EmployeeMasterEntity | null> {
    await this.repo.update(id, data as Record<string, unknown>);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.update(id, { deletedAt: new Date() });
  }
}
