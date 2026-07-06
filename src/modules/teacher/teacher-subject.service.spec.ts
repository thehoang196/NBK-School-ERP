import { NotFoundException } from '@nestjs/common';
import { TeacherSubjectService } from './teacher-subject.service';
import { TeacherSubjectRepository } from './teacher-subject.repository';
import { TeacherRepository } from './teacher.repository';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherStatus, TeacherType } from '../../common/enums/status.enum';
import { DataSource } from 'typeorm';

describe('TeacherSubjectService - Unit Tests (Edge Cases)', () => {
  let service: TeacherSubjectService;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let teacherSubjectRepository: jest.Mocked<TeacherSubjectRepository>;
  let dataSource: { transaction: jest.Mock };

  const mockTeacher: TeacherEntity = {
    id: 'teacher-uuid-001',
    schoolId: 'school-uuid-001',
    employeeCode: 'GV001',
    fullName: 'Nguy\u1EC5n V\u0103n A',
    shortName: null,
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
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
  };

  beforeEach(() => {
    teacherRepository = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
    } as unknown as jest.Mocked<TeacherRepository>;

    teacherSubjectRepository = {
      findByTeacherId: jest.fn(),
      findByTeacherIds: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<TeacherSubjectRepository>;

    dataSource = {
      transaction: jest.fn(),
    };

    service = new TeacherSubjectService(
      teacherSubjectRepository,
      teacherRepository,
      dataSource as unknown as DataSource,
    );
  });

  describe('assignSubjects - teacherId does not exist (Req 1.5)', () => {
    it('should throw NotFoundException when teacherId does not exist', async () => {
      teacherRepository.findByIdInternal.mockResolvedValue(null);

      await expect(
        service.assignSubjects('nonexistent-teacher-id', ['subject-uuid-001']),
      ).rejects.toThrow(NotFoundException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('assignSubjects - teacherId soft-deleted (Req 1.5)', () => {
    it('should throw NotFoundException when teacher is soft-deleted', async () => {
      // findByIdInternal filters by deletedAt IS NULL, so soft-deleted teacher returns null
      teacherRepository.findByIdInternal.mockResolvedValue(null);

      await expect(
        service.assignSubjects('soft-deleted-teacher-id', ['subject-uuid-001']),
      ).rejects.toThrow(NotFoundException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('assignSubjects - subjectId does not exist (Req 1.4)', () => {
    it('should throw NotFoundException when subjectId does not exist', async () => {
      teacherRepository.findByIdInternal.mockResolvedValue(mockTeacher);

      // Mock transaction to simulate manager.findOne returning null for subject
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const fakeManager = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            save: jest.fn(),
          };
          return cb(fakeManager);
        },
      );

      await expect(
        service.assignSubjects('teacher-uuid-001', ['nonexistent-subject-id']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignSubjects - subjectId soft-deleted (Req 1.4)', () => {
    it('should throw NotFoundException when subject is soft-deleted', async () => {
      teacherRepository.findByIdInternal.mockResolvedValue(mockTeacher);

      // manager.findOne filters by deletedAt: IsNull(), so soft-deleted subject returns null
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const fakeManager = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            save: jest.fn(),
          };
          return cb(fakeManager);
        },
      );

      await expect(
        service.assignSubjects('teacher-uuid-001', ['soft-deleted-subject-id']),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
