import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { TeacherSubjectRepository } from './teacher-subject.repository';
import { TeacherRepository } from './teacher.repository';
import { TeacherSubjectEntity } from './entities/teacher-subject.entity';
import { SubjectEntity } from '../subject/entities/subject.entity';

@Injectable()
export class TeacherSubjectService {
  constructor(
    private readonly teacherSubjectRepository: TeacherSubjectRepository,
    private readonly teacherRepository: TeacherRepository,
    private readonly dataSource: DataSource,
  ) {}

  async assignSubjects(
    teacherId: string,
    subjectIds: string[],
  ): Promise<TeacherSubjectEntity[]> {
    const teacher = await this.teacherRepository.findByIdInternal(teacherId);
    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }

    return this.dataSource.transaction(async (manager) => {
      const created: TeacherSubjectEntity[] = [];

      for (const subjectId of subjectIds) {
        const subject = await manager.findOne(SubjectEntity, {
          where: { id: subjectId, deletedAt: IsNull() },
        });
        if (!subject) {
          throw new NotFoundException('Không tìm thấy môn học');
        }

        if (subject.schoolId !== teacher.schoolId) {
          throw new BadRequestException(
            'Môn học không thuộc cùng trường với giáo viên',
          );
        }

        const existing = await manager.findOne(TeacherSubjectEntity, {
          where: { teacherId, subjectId, deletedAt: IsNull() },
        });
        if (existing) {
          throw new ConflictException('Giáo viên đã được gán môn học này');
        }

        const entity = manager.create(TeacherSubjectEntity, {
          teacherId,
          subjectId,
        });
        const saved = await manager.save(entity);
        created.push(saved);
      }

      return created;
    });
  }

  async removeAssignment(
    teacherId: string,
    assignmentId: string,
  ): Promise<void> {
    const assignment =
      await this.teacherSubjectRepository.findById(assignmentId);
    if (!assignment || assignment.teacherId !== teacherId) {
      throw new NotFoundException('Không tìm thấy liên kết môn học giảng dạy');
    }
    await this.teacherSubjectRepository.softDelete(assignmentId);
  }

  async getSubjectsForTeacher(teacherId: string): Promise<SubjectEntity[]> {
    const links =
      await this.teacherSubjectRepository.findByTeacherId(teacherId);
    return links.map((link) => link.subject);
  }

  /**
   * Trả về các liên kết (kèm assignmentId) của giáo viên — dùng cho endpoint
   * GET /teachers/:teacherId/subjects để frontend có đủ thông tin gỡ (DELETE
   * .../subjects/:assignmentId) từng môn học cụ thể.
   */
  async getAssignmentsForTeacher(
    teacherId: string,
  ): Promise<TeacherSubjectEntity[]> {
    return this.teacherSubjectRepository.findByTeacherId(teacherId);
  }

  async getSubjectsMapForTeachers(
    teacherIds: string[],
  ): Promise<Map<string, SubjectEntity[]>> {
    const links =
      await this.teacherSubjectRepository.findByTeacherIds(teacherIds);
    const map = new Map<string, SubjectEntity[]>();

    for (const teacherId of teacherIds) {
      map.set(teacherId, []);
    }

    for (const link of links) {
      const list = map.get(link.teacherId) ?? [];
      list.push(link.subject);
      map.set(link.teacherId, list);
    }

    return map;
  }

  async hasAssignment(teacherId: string, subjectId: string): Promise<boolean> {
    const link = await this.teacherSubjectRepository.findOne(
      teacherId,
      subjectId,
    );
    return link !== null;
  }
}
