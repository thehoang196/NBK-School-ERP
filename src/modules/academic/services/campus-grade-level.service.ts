import { Injectable } from '@nestjs/common';
import { CampusGradeLevelRepository } from '../repositories/campus-grade-level.repository';
import { CampusGradeLevelEntity } from '../entities/campus-grade-level.entity';
import { AssignGradeLevelDto } from '../dto/campus-grade-level/assign-grade-level.dto';
import { CampusGradeLevelQueryDto } from '../dto/campus-grade-level/campus-grade-level-query.dto';
import { GradeLevel } from '../enums';
import {
  CampusGradeLevelExistsException,
  CampusGradeLevelNotFoundException,
} from '../exceptions';

@Injectable()
export class CampusGradeLevelService {
  constructor(
    private readonly campusGradeLevelRepository: CampusGradeLevelRepository,
  ) {}

  async assign(
    dto: AssignGradeLevelDto,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity> {
    const existing = await this.campusGradeLevelRepository.findByCampusAndGrade(
      dto.campusId,
      dto.gradeLevel,
      schoolId,
    );

    if (existing) {
      throw new CampusGradeLevelExistsException();
    }

    return this.campusGradeLevelRepository.create({
      campusId: dto.campusId,
      gradeLevel: dto.gradeLevel,
      schoolId,
    });
  }

  async findAll(
    query: CampusGradeLevelQueryDto,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity[]> {
    if (query.campusId && query.gradeLevel) {
      const record = await this.campusGradeLevelRepository.findByCampusAndGrade(
        query.campusId,
        query.gradeLevel,
        schoolId,
      );
      return record ? [record] : [];
    }

    if (query.campusId) {
      return this.campusGradeLevelRepository.findByCampus(
        query.campusId,
        schoolId,
      );
    }

    if (query.gradeLevel) {
      return this.campusGradeLevelRepository.findByGradeLevel(
        query.gradeLevel,
        schoolId,
      );
    }

    return this.campusGradeLevelRepository.findAllBySchool(schoolId);
  }

  async remove(id: string, schoolId: string): Promise<void> {
    const record = await this.campusGradeLevelRepository.findById(id, schoolId);

    if (!record) {
      throw new CampusGradeLevelNotFoundException();
    }

    await this.campusGradeLevelRepository.softDelete(id);
  }

  async findByCampus(
    campusId: string,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity[]> {
    return this.campusGradeLevelRepository.findByCampus(campusId, schoolId);
  }

  async findByGradeLevel(
    gradeLevel: GradeLevel,
    schoolId: string,
  ): Promise<CampusGradeLevelEntity[]> {
    return this.campusGradeLevelRepository.findByGradeLevel(
      gradeLevel,
      schoolId,
    );
  }

  async exists(
    campusId: string,
    gradeLevel: GradeLevel,
    schoolId: string,
  ): Promise<boolean> {
    const record = await this.campusGradeLevelRepository.findByCampusAndGrade(
      campusId,
      gradeLevel,
      schoolId,
    );
    return record !== null;
  }
}
