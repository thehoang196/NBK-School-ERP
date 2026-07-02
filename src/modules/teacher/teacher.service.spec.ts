import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { TeacherRepository } from './teacher.repository';
import { TeacherSubjectService } from './teacher-subject.service';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherStatus, TeacherType, Gender } from '../../common/enums/status.enum';

describe('TeacherService', () => {
  let service: TeacherService;
  let repository: jest.Mocked<TeacherRepository>;
  let teacherSubjectService: jest.Mocked<TeacherSubjectService>;

  const mockTeacher: TeacherEntity = {
    id: 'teacher-uuid',
    schoolId: 'school-uuid',
    employeeCode: 'GV001',
    fullName: 'Nguyễn Văn A',
    shortName: 'NVA',
    gender: Gender.MALE,
    dateOfBirth: '1985-05-15',
    phone: '0901234567',
    email: 'nva@school.edu.vn',
    departmentId: 'dept-uuid',
    position: 'Tổ trưởng',
    teacherType: TeacherType.FULL_TIME,
    maxPeriodsPerWeek: 20,
    minPeriodsPerWeek: 10,
    maxPeriodsPerDay: 6,
    unavailableSlots: [{ dayOfWeek: 2, periodId: 'period-uuid' }],
    status: TeacherStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    school: undefined as never,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherService,
        {
          provide: TeacherRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: TeacherSubjectService,
          useValue: {
            getSubjectsForTeacher: jest.fn().mockResolvedValue([]),
            getSubjectsMapForTeachers: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
    repository = module.get(TeacherRepository);
    teacherSubjectService = module.get(TeacherSubjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated teachers', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockTeacher], 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return teacher by id with subjects', async () => {
      repository.findById.mockResolvedValue(mockTeacher);
      const result = await service.findById('teacher-uuid');
      expect(result).toEqual({ ...mockTeacher, subjects: [] });
      expect(teacherSubjectService.getSubjectsForTeacher).toHaveBeenCalledWith('teacher-uuid');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a teacher with unavailable_slots', async () => {
      const dto = {
        schoolId: 'school-uuid',
        employeeCode: 'GV001',
        fullName: 'Nguyễn Văn A',
        unavailableSlots: [{ dayOfWeek: 2, periodId: 'period-uuid' }],
      };
      repository.create.mockResolvedValue(mockTeacher);

      const result = await service.create(dto);
      expect(result.unavailableSlots).toHaveLength(1);
      expect(result.unavailableSlots![0].dayOfWeek).toBe(2);
    });
  });

  describe('update', () => {
    it('should update a teacher', async () => {
      const dto = { fullName: 'Trần Thị B' };
      const updated = { ...mockTeacher, fullName: 'Trần Thị B' };

      repository.findById.mockResolvedValue(mockTeacher);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('teacher-uuid', dto);
      expect(result.fullName).toBe('Trần Thị B');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.update('nonexistent', { fullName: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a teacher', async () => {
      repository.findById.mockResolvedValue(mockTeacher);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('teacher-uuid');
      expect(repository.softDelete).toHaveBeenCalledWith('teacher-uuid');
    });
  });
});
