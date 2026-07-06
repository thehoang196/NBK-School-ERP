import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CampusGradeLevelEntity } from '../entities/campus-grade-level.entity';
import { GradeLevel } from '../enums';

@Injectable()
export class CampusGradeLevelRepository {
  constructor(
    @InjectRepository(CampusGradeLevelEntity)
    private readonly repo: Repository<CampusGradeLevelEntity>,
  ) {}

  async create(
    data: Partial<CampusGradeLevelEntity>,
  ): Promise<CampusGradeLevelEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findAllBySchool(schoolId: string): Promise<CampusGradeLevelEntity[]> {
    return this.repo.find({
      where: { schoolId, deletedAt: IsNull() },
    });
  }

  async findByCampus(
    campusId: string,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity[]> {
    return this.repo.find({
      where: { campusId, schoolId, deletedAt: IsNull() },
    });
  }

  async findByGradeLevel(
    gradeLevel: GradeLevel,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity[]> {
    return this.repo.find({
      where: { gradeLevel, schoolId, deletedAt: IsNull() },
    });
  }

  async findByCampusAndGrade(
    campusId: string,
    gradeLevel: GradeLevel,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity | null> {
    return this.repo.findOne({
      where: { campusId, gradeLevel, schoolId, deletedAt: IsNull() },
    });
  }

  async findById(
    id: string,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity | null> {
    return this.repo.findOne({
      where: { id, schoolId, deletedAt: IsNull() },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
