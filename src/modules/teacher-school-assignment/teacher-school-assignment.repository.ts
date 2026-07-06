import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TeacherSchoolAssignmentEntity } from './entities/teacher-school-assignment.entity';
import { AssignmentRole } from './enums/assignment-role.enum';
import { AssignmentStatus } from './enums/assignment-status.enum';

@Injectable()
export class TeacherSchoolAssignmentRepository {
  constructor(
    @InjectRepository(TeacherSchoolAssignmentEntity)
    private readonly repo: Repository<TeacherSchoolAssignmentEntity>,
  ) {}

  async findByTeacher(
    teacherId: string,
  ): Promise<TeacherSchoolAssignmentEntity[]> {
    return this.repo.find({
      where: { teacherId, deletedAt: IsNull() },
      relations: { school: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findBySchool(
    schoolId: string,
  ): Promise<TeacherSchoolAssignmentEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
      relations: { teacher: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveByTeacher(
    teacherId: string,
  ): Promise<TeacherSchoolAssignmentEntity[]> {
    return this.repo.find({
      where: {
        teacherId,
        status: AssignmentStatus.ACTIVE,
        deletedAt: IsNull(),
      },
      relations: { school: true },
      order: { role: 'ASC' },
    });
  }

  async countSecondaryByTeacher(teacherId: string): Promise<number> {
    return this.repo.count({
      where: {
        teacherId,
        role: AssignmentRole.SECONDARY,
        status: AssignmentStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });
  }

  async findByTeacherAndSchool(
    teacherId: string,
    schoolId: string,
  ): Promise<TeacherSchoolAssignmentEntity | null> {
    return this.repo.findOne({
      where: { teacherId, schoolId, deletedAt: IsNull() },
      relations: { school: true, teacher: true },
    });
  }

  async create(
    data: Partial<TeacherSchoolAssignmentEntity>,
  ): Promise<TeacherSchoolAssignmentEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    data: Partial<TeacherSchoolAssignmentEntity>,
  ): Promise<TeacherSchoolAssignmentEntity | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { school: true, teacher: true },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
