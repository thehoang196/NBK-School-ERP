import { Injectable } from '@nestjs/common';
import { TeacherSubjectService } from '../../teacher/teacher-subject.service';

export interface CompetencyValidationResult {
  valid: boolean;
  message?: string;
  teacherId: string;
  subjectId: string;
}

/**
 * CompetencyValidator — Kiểm tra giáo viên có năng lực dạy môn học hay không.
 *
 * Quy tắc:
 * - Giáo viên PHẢI có teacher_subject mapping với môn học
 * - Nếu không có → trả valid = false + message cảnh báo
 *
 * Lưu ý: Theo requirement hiện tại, đây là WARNING (không chặn) nhưng
 * validator trả về kết quả để caller quyết định xử lý.
 */
@Injectable()
export class CompetencyValidator {
  constructor(
    private readonly teacherSubjectService: TeacherSubjectService,
  ) {}

  async validate(
    teacherId: string,
    subjectId: string,
  ): Promise<CompetencyValidationResult> {
    const hasCompetency = await this.teacherSubjectService.hasAssignment(
      teacherId,
      subjectId,
    );

    if (!hasCompetency) {
      return {
        valid: false,
        message:
          'Giáo viên chưa được khai báo năng lực giảng dạy môn học này. Vui lòng kiểm tra lại phân công.',
        teacherId,
        subjectId,
      };
    }

    return {
      valid: true,
      teacherId,
      subjectId,
    };
  }
}
