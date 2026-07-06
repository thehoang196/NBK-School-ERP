import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TeacherRepository } from './teacher.repository';
import { TeacherEntity } from './entities/teacher.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeacherQueryDto } from './dto/teacher-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';
import { TeacherSubjectService } from './teacher-subject.service';
import { SubjectEntity } from '../subject/entities/subject.entity';
import { DuplicateEmployeeCodeException } from './exceptions/duplicate-employee-code.exception';
import {
  TeacherCreatedEvent,
  TeacherUpdatedEvent,
  TeacherDeletedEvent,
} from './events/teacher.events';

export interface TeacherWithSubjects extends TeacherEntity {
  subjects: SubjectEntity[];
}

@Injectable()
export class TeacherService {
  constructor(
    private readonly teacherRepository: TeacherRepository,
    private readonly teacherSubjectService: TeacherSubjectService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    query: TeacherQueryDto,
    schoolId: string,
  ): Promise<PaginatedResponse<TeacherWithSubjects>> {
    const [data, total] = await this.teacherRepository.findAll(query, schoolId);
    const totalPages = Math.ceil(total / query.limit);

    const subjectsMap =
      await this.teacherSubjectService.getSubjectsMapForTeachers(
        data.map((teacher) => teacher.id),
      );
    const dataWithSubjects: TeacherWithSubjects[] = data.map((teacher) => ({
      ...teacher,
      subjects: subjectsMap.get(teacher.id) ?? [],
    }));

    return {
      success: true,
      data: dataWithSubjects,
      message: 'Lấy danh sách giáo viên thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string, schoolId: string): Promise<TeacherWithSubjects> {
    const teacher = await this.teacherRepository.findById(id, schoolId);
    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }
    const subjects = await this.teacherSubjectService.getSubjectsForTeacher(id);
    return { ...teacher, subjects };
  }

  async create(dto: CreateTeacherDto): Promise<TeacherEntity> {
    // Validate unique employeeCode within school
    const existing = await this.teacherRepository.findByEmployeeCode(
      dto.employeeCode,
      dto.schoolId,
    );
    if (existing) {
      throw new DuplicateEmployeeCodeException();
    }

    const teacher = await this.teacherRepository.create(dto);

    // Publish event for downstream systems (Payroll, Notification, etc.)
    this.eventEmitter.emit(
      TeacherCreatedEvent.eventName,
      new TeacherCreatedEvent(
        teacher.id,
        teacher.schoolId,
        teacher.employeeCode,
        teacher.fullName,
      ),
    );

    return teacher;
  }

  async update(
    id: string,
    schoolId: string,
    dto: UpdateTeacherDto,
  ): Promise<TeacherEntity> {
    const existing = await this.findById(id, schoolId);

    // Validate unique employeeCode if changed
    if (dto.employeeCode && dto.employeeCode !== existing.employeeCode) {
      const duplicate = await this.teacherRepository.findByEmployeeCode(
        dto.employeeCode,
        schoolId,
      );
      if (duplicate) {
        throw new DuplicateEmployeeCodeException();
      }
    }

    const updated = await this.teacherRepository.update(id, schoolId, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }

    // Determine which fields changed
    const changedFields = Object.keys(dto).filter((key) => {
      const dtoValue = (dto as unknown as Record<string, unknown>)[key];
      const existingValue = (existing as unknown as Record<string, unknown>)[
        key
      ];
      return dtoValue !== undefined && dtoValue !== existingValue;
    });

    if (changedFields.length > 0) {
      this.eventEmitter.emit(
        TeacherUpdatedEvent.eventName,
        new TeacherUpdatedEvent(
          updated.id,
          updated.schoolId,
          updated.employeeCode,
          changedFields,
        ),
      );
    }

    return updated;
  }

  async remove(id: string, schoolId: string): Promise<void> {
    const teacher = await this.findById(id, schoolId);
    await this.teacherRepository.softDelete(id, schoolId);

    this.eventEmitter.emit(
      TeacherDeletedEvent.eventName,
      new TeacherDeletedEvent(
        teacher.id,
        teacher.schoolId,
        teacher.employeeCode,
      ),
    );
  }
}
