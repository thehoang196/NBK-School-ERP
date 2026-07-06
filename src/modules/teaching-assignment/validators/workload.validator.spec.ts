import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkloadValidator } from './workload.validator';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { TeachingAssignmentRepository } from '../teaching-assignment.repository';

describe('WorkloadValidator', () => {
  let validator: WorkloadValidator;
  let teacherRepo: { findOne: jest.Mock };
  let assignmentRepo: { sumPeriodsByTeacher: jest.Mock; findById: jest.Mock };

  const mockTeacher = {
    id: 'teacher-uuid-1',
    fullName: 'Nguyễn Văn A',
    maxPeriodsPerWeek: 20,
    minPeriodsPerWeek: 10,
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkloadValidator,
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: TeachingAssignmentRepository,
          useValue: {
            sumPeriodsByTeacher: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    validator = module.get<WorkloadValidator>(WorkloadValidator);
    teacherRepo = module.get(getRepositoryToken(TeacherEntity));
    assignmentRepo = module.get(TeachingAssignmentRepository);
  });

  it('should return valid when within workload limit', async () => {
    teacherRepo.findOne.mockResolvedValue(mockTeacher);
    assignmentRepo.sumPeriodsByTeacher.mockResolvedValue(15);

    const result = await validator.validate('teacher-uuid-1', 'sem-1', 4);

    expect(result.valid).toBe(true);
    expect(result.currentPeriods).toBe(15);
    expect(result.maxPeriods).toBe(20);
  });

  it('should return invalid when exceeding workload limit', async () => {
    teacherRepo.findOne.mockResolvedValue(mockTeacher);
    assignmentRepo.sumPeriodsByTeacher.mockResolvedValue(18);

    const result = await validator.validate('teacher-uuid-1', 'sem-1', 5);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('vượt định mức');
    expect(result.message).toContain('Nguyễn Văn A');
  });

  it('should return invalid when teacher not found', async () => {
    teacherRepo.findOne.mockResolvedValue(null);

    const result = await validator.validate('non-existent', 'sem-1', 5);

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Không tìm thấy giáo viên');
  });

  it('should exclude current assignment when updating', async () => {
    teacherRepo.findOne.mockResolvedValue(mockTeacher);
    assignmentRepo.sumPeriodsByTeacher.mockResolvedValue(20);
    assignmentRepo.findById.mockResolvedValue({ periodsPerWeek: 5 });

    const result = await validator.validate(
      'teacher-uuid-1',
      'sem-1',
      5,
      'existing-assignment-id',
    );

    // 20 - 5 (excluded) + 5 (new) = 20 <= 20 → valid
    expect(result.valid).toBe(true);
  });

  it('should return exact boundary as valid (equal to max)', async () => {
    teacherRepo.findOne.mockResolvedValue(mockTeacher);
    assignmentRepo.sumPeriodsByTeacher.mockResolvedValue(16);

    const result = await validator.validate('teacher-uuid-1', 'sem-1', 4);

    // 16 + 4 = 20 = max → valid
    expect(result.valid).toBe(true);
  });
});
