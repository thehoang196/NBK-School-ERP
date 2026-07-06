import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DepartmentMemberEntity } from './entities/department-member.entity';
import { MemberQueryDto } from './dto/member-query.dto';
import { PositionTitle, ManagementLevel } from './enums';

@Injectable()
export class DepartmentMemberRepository {
  constructor(
    @InjectRepository(DepartmentMemberEntity)
    private readonly repo: Repository<DepartmentMemberEntity>,
  ) {}

  async findByDepartment(
    departmentId: string,
    query: MemberQueryDto,
  ): Promise<[DepartmentMemberEntity[], number]> {
    const { page, limit, sortBy, sortOrder, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repo
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.teacher', 'teacher')
      .where('member.departmentId = :departmentId', { departmentId })
      .andWhere('member.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(teacher.fullName ILIKE :search OR teacher.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy) {
      queryBuilder.orderBy(`member.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('teacher.fullName', 'ASC');
    }

    queryBuilder.skip(skip).take(limit);

    return queryBuilder.getManyAndCount();
  }

  async findById(id: string): Promise<DepartmentMemberEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { teacher: true },
    });
  }

  async findByTeacherAndDepartment(
    teacherId: string,
    departmentId: string,
  ): Promise<DepartmentMemberEntity | null> {
    return this.repo.findOne({
      where: { teacherId, departmentId, deletedAt: IsNull() },
    });
  }

  async create(
    data: Partial<DepartmentMemberEntity>,
  ): Promise<DepartmentMemberEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async updatePositionTitle(
    id: string,
    positionTitle: PositionTitle,
  ): Promise<DepartmentMemberEntity | null> {
    await this.repo.update(id, { positionTitle });
    return this.findById(id);
  }

  async updateManagementLevel(
    id: string,
    level: ManagementLevel | null,
  ): Promise<DepartmentMemberEntity | null> {
    await this.repo.update(id, { managementLevel: level });
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  /**
   * Find all department IDs where the given teacher is an active member.
   * Used for Teacher role access control — teachers can only access their own departments.
   */
  async findDepartmentIdsByTeacher(teacherId: string): Promise<string[]> {
    const members = await this.repo.find({
      where: { teacherId, deletedAt: IsNull() },
      select: ['departmentId'],
    });
    return members.map((m) => m.departmentId);
  }
}
