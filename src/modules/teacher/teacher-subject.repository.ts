import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { TeacherSubjectEntity } from './entities/teacher-subject.entity';

@Injectable()
export class TeacherSubjectRepository {
  constructor(
    @InjectRepository(TeacherSubjectEntity)
    private readonly repo: Repository<TeacherSubjectEntity>,
  ) {}

  async findByTeacherId(teacherId: string): Promise<TeacherSubjectEntity[]> {
    return this.repo.find({
      where: { teacherId, deletedAt: IsNull() },
      relations: { subject: true },
    });
  }

  async findByTeacherIds(
    teacherIds: string[],
  ): Promise<TeacherSubjectEntity[]> {
    if (teacherIds.length === 0) {
      return [];
    }
    return this.repo.find({
      where: { teacherId: In(teacherIds), deletedAt: IsNull() },
      relations: { subject: true },
    });
  }

  async findOne(
    teacherId: string,
    subjectId: string,
  ): Promise<TeacherSubjectEntity | null> {
    return this.repo.findOne({
      where: { teacherId, subjectId, deletedAt: IsNull() },
    });
  }

  async findById(id: string): Promise<TeacherSubjectEntity | null> {
    return this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async create(
    data: Partial<TeacherSubjectEntity>,
  ): Promise<TeacherSubjectEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.update(id, { deletedAt: new Date() });
  }
}
