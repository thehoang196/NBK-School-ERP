import { Injectable, NotFoundException } from '@nestjs/common';
import { TeacherRepository } from './teacher.repository';
import { TeacherEntity } from './entities/teacher.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeacherQueryDto } from './dto/teacher-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';
import { TeacherSubjectService } from './teacher-subject.service';
import { SubjectEntity } from '../subject/entities/subject.entity';

export interface TeacherWithSubjects extends TeacherEntity {
  subjects: SubjectEntity[];
}

@Injectable()
export class TeacherService {
  constructor(
    private readonly teacherRepository: TeacherRepository,
    private readonly teacherSubjectService: TeacherSubjectService,
  ) {}

  async findAll(query: TeacherQueryDto): Promise<PaginatedResponse<TeacherWithSubjects>> {
    const [data, total] = await this.teacherRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    const subjectsMap = await this.teacherSubjectService.getSubjectsMapForTeachers(
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

  async findById(id: string): Promise<TeacherWithSubjects> {
    const teacher = await this.teacherRepository.findById(id);
    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }
    const subjects = await this.teacherSubjectService.getSubjectsForTeacher(id);
    return { ...teacher, subjects };
  }

  async create(dto: CreateTeacherDto): Promise<TeacherEntity> {
    return this.teacherRepository.create(dto);
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<TeacherEntity> {
    await this.findById(id);
    const updated = await this.teacherRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.teacherRepository.softDelete(id);
  }
}
