import { Test, TestingModule } from '@nestjs/testing';
import { CompetencyValidator } from './competency.validator';
import { TeacherSubjectService } from '../../teacher/teacher-subject.service';

describe('CompetencyValidator', () => {
  let validator: CompetencyValidator;
  let teacherSubjectService: { hasAssignment: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetencyValidator,
        {
          provide: TeacherSubjectService,
          useValue: {
            hasAssignment: jest.fn(),
          },
        },
      ],
    }).compile();

    validator = module.get<CompetencyValidator>(CompetencyValidator);
    teacherSubjectService = module.get(TeacherSubjectService);
  });

  it('should return valid when teacher has competency for subject', async () => {
    teacherSubjectService.hasAssignment.mockResolvedValue(true);

    const result = await validator.validate('teacher-1', 'subject-1');

    expect(result.valid).toBe(true);
    expect(result.teacherId).toBe('teacher-1');
    expect(result.subjectId).toBe('subject-1');
    expect(result.message).toBeUndefined();
  });

  it('should return invalid when teacher lacks competency', async () => {
    teacherSubjectService.hasAssignment.mockResolvedValue(false);

    const result = await validator.validate('teacher-1', 'subject-1');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('chưa được khai báo năng lực');
    expect(result.teacherId).toBe('teacher-1');
    expect(result.subjectId).toBe('subject-1');
  });

  it('should call teacherSubjectService with correct params', async () => {
    teacherSubjectService.hasAssignment.mockResolvedValue(true);

    await validator.validate('teacher-uuid', 'subject-uuid');

    expect(teacherSubjectService.hasAssignment).toHaveBeenCalledWith(
      'teacher-uuid',
      'subject-uuid',
    );
  });
});
