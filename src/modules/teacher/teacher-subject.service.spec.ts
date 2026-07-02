import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TeacherSubjectService } from './teacher-subject.service';
import { TeacherSubjectRepository } from './teacher-subject.repository';
import { TeacherRepository } from './teacher.repository';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherSubjectEntity } from './entities/teacher-subject.entity';
import { SubjectEntity } from '../subject/entities/subject.entity';
import { TeacherStatus, TeacherType, SubjectType, RoomType } from '../../common/enums/status.enum';

describe('TeacherSubjectService', () => {
  let service: TeacherSubjectService;
  let teacherSubjectRepository: jest.Mocked<TeacherSubjectRepository>;
  let teacherRepository: jest.Mocked<TeacherRepository>;

  const mockTeacher: TeacherEntity = {
    id: 'teacher-uuid',
    schoolId: 'school-uuid',
    employeeCode: 'GV001',
    fullName: 'Nguyễn Văn A',
    shortName: 'NVA',
    gender: null,
    dateOfBirth: null,
    phone: null,
    email: null,
    citizenId: null,
    gradeId: null,
    grade: undefined as never,
    departmentId: null,
    department: undefined as never,
    jobTitle: null,
    managementLevel: null,
    position: null,
    teacherType: TeacherType.FULL_TIME,
    maxPeriodsPerWeek: 20,
    minPeriodsPerWeek: 0,
    maxPeriodsPerDay: 6,
    unavailableSlots: null,
    status: TeacherStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    school: undefined as never,
  };

  const mockSubject: SubjectEntity = {
    id: 'subject-uuid',
    schoolId: 'school-uuid',
    code: 'TOAN',
    name: 'Toán',
    shortName: 'T',
    subjectType: SubjectType.REQUIRED,
    periodsPerWeek: 4,
    requiresRoomType: RoomType.STANDARD,
    colorCode: null,
    isDoublePeriod: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    school: undefined as never,
  };

  const mockLink: TeacherSubjectEntity = {
    id: 'link-uuid',
    teacherId: 'teacher-uuid',
    subjectId: 'subject-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    teacher: undefined as never,
    subject: mockSubject,
  };

  // Manager giả lập cho DataSource.transaction, mô phỏng findOne/create/save trong bộ nhớ.
  const buildFakeManager = (opts: {
    subjects?: SubjectEntity[];
    existingLinks?: TeacherSubjectEntity[];
  }) => {
    const subjects = opts.subjects ?? [];
    const existingLinks = opts.existingLinks ?? [];
    const savedEntities: Partial<TeacherSubjectEntity>[] = [];

    return {
      findOne: jest.fn(async (entityClass: unknown, options: { where: Record<string, unknown> }) => {
        if (entityClass === SubjectEntity) {
          return subjects.find((s) => s.id === options.where.id) ?? null;
        }
        if (entityClass === TeacherSubjectEntity) {
          return (
            existingLinks.find(
              (l) =>
                l.teacherId === options.where.teacherId &&
                l.subjectId === options.where.subjectId,
            ) ?? null
          );
        }
        return null;
      }),
      create: jest.fn((_entityClass: unknown, data: Partial<TeacherSubjectEntity>) => data),
      save: jest.fn(async (data: Partial<TeacherSubjectEntity>) => {
        const saved = { ...data, id: 'new-link-uuid' } as TeacherSubjectEntity;
        savedEntities.push(saved);
        return saved;
      }),
    };
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherSubjectService,
        {
          provide: TeacherSubjectRepository,
          useValue: {
            findByTeacherId: jest.fn(),
            findByTeacherIds: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: TeacherRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TeacherSubjectService>(TeacherSubjectService);
    teacherSubjectRepository = module.get(TeacherSubjectRepository);
    teacherRepository = module.get(TeacherRepository);

    mockDataSource.transaction.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignSubjects', () => {
    it('should throw NotFoundException if teacher does not exist', async () => {
      teacherRepository.findById.mockResolvedValue(null);

      await expect(service.assignSubjects('nonexistent', ['subject-uuid'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if subject does not exist', async () => {
      teacherRepository.findById.mockResolvedValue(mockTeacher);
      const fakeManager = buildFakeManager({ subjects: [] });
      mockDataSource.transaction.mockImplementation(async (cb: (m: unknown) => unknown) => cb(fakeManager));

      await expect(service.assignSubjects('teacher-uuid', ['subject-uuid'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if subject belongs to a different school', async () => {
      teacherRepository.findById.mockResolvedValue(mockTeacher);
      const otherSchoolSubject = { ...mockSubject, schoolId: 'other-school-uuid' };
      const fakeManager = buildFakeManager({ subjects: [otherSchoolSubject] });
      mockDataSource.transaction.mockImplementation(async (cb: (m: unknown) => unknown) => cb(fakeManager));

      await expect(service.assignSubjects('teacher-uuid', ['subject-uuid'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if link already exists and is not deleted', async () => {
      teacherRepository.findById.mockResolvedValue(mockTeacher);
      const fakeManager = buildFakeManager({
        subjects: [mockSubject],
        existingLinks: [mockLink],
      });
      mockDataSource.transaction.mockImplementation(async (cb: (m: unknown) => unknown) => cb(fakeManager));

      await expect(service.assignSubjects('teacher-uuid', ['subject-uuid'])).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create links for all valid subjectIds', async () => {
      teacherRepository.findById.mockResolvedValue(mockTeacher);
      const secondSubject = { ...mockSubject, id: 'subject-uuid-2' };
      const fakeManager = buildFakeManager({ subjects: [mockSubject, secondSubject] });
      mockDataSource.transaction.mockImplementation(async (cb: (m: unknown) => unknown) => cb(fakeManager));

      const result = await service.assignSubjects('teacher-uuid', [
        'subject-uuid',
        'subject-uuid-2',
      ]);

      expect(result).toHaveLength(2);
      expect(fakeManager.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeAssignment', () => {
    it('should soft delete an existing link belonging to the teacher', async () => {
      teacherSubjectRepository.findById.mockResolvedValue(mockLink);

      await service.removeAssignment('teacher-uuid', 'link-uuid');

      expect(teacherSubjectRepository.softDelete).toHaveBeenCalledWith('link-uuid');
    });

    it('should throw NotFoundException if link does not exist', async () => {
      teacherSubjectRepository.findById.mockResolvedValue(null);

      await expect(service.removeAssignment('teacher-uuid', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if link belongs to a different teacher', async () => {
      teacherSubjectRepository.findById.mockResolvedValue({
        ...mockLink,
        teacherId: 'another-teacher-uuid',
      });

      await expect(service.removeAssignment('teacher-uuid', 'link-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should give the same NotFoundException for an already-removed link as for a nonexistent one', async () => {
      teacherSubjectRepository.findById.mockResolvedValue(null);

      await expect(service.removeAssignment('teacher-uuid', 'already-removed')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.removeAssignment('teacher-uuid', 'never-existed')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSubjectsForTeacher', () => {
    it('should return subjects from non-deleted links', async () => {
      teacherSubjectRepository.findByTeacherId.mockResolvedValue([mockLink]);

      const result = await service.getSubjectsForTeacher('teacher-uuid');

      expect(result).toEqual([mockSubject]);
    });
  });

  describe('getSubjectsMapForTeachers', () => {
    it('should map subjects per teacher, including teachers with no subjects', async () => {
      teacherSubjectRepository.findByTeacherIds.mockResolvedValue([mockLink]);

      const result = await service.getSubjectsMapForTeachers(['teacher-uuid', 'teacher-uuid-2']);

      expect(result.get('teacher-uuid')).toEqual([mockSubject]);
      expect(result.get('teacher-uuid-2')).toEqual([]);
    });
  });

  describe('hasAssignment', () => {
    it('should return true when a link exists', async () => {
      teacherSubjectRepository.findOne.mockResolvedValue(mockLink);
      const result = await service.hasAssignment('teacher-uuid', 'subject-uuid');
      expect(result).toBe(true);
    });

    it('should return false when no link exists', async () => {
      teacherSubjectRepository.findOne.mockResolvedValue(null);
      const result = await service.hasAssignment('teacher-uuid', 'subject-uuid');
      expect(result).toBe(false);
    });
  });
});
