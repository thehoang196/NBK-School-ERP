import { Test, TestingModule } from '@nestjs/testing';
import { TeacherService, TeacherWithSubjects } from './teacher.service';
import { TeacherRepository } from './teacher.repository';
import { TeacherSubjectService } from './teacher-subject.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TeacherEntity, UnavailableSlot } from './entities/teacher.entity';
import {
  Gender,
  TeacherType,
  TeacherStatus,
} from '../../common/enums/status.enum';

/**
 * Integration test cho backward compatibility.
 * Validates: Requirements 7.3, 7.4
 *
 * Đảm bảo API GET /api/v1/teachers vẫn trả về đầy đủ tất cả fields,
 * bao gồm legacy fields (citizenId, dateOfBirth, phone, email, position,
 * teacherType, minPeriodsPerWeek, maxPeriodsPerDay, unavailableSlots).
 */
describe('Teacher Backward Compatibility', () => {
  let service: TeacherService;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let teacherSubjectService: jest.Mocked<TeacherSubjectService>;

  const mockUnavailableSlots: UnavailableSlot[] = [
    { dayOfWeek: 2, periodId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
  ];

  const mockTeacherWithLegacyData: TeacherEntity = {
    id: '11111111-1111-1111-1111-111111111111',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    // Standard fields
    schoolId: '22222222-2222-2222-2222-222222222222',
    school: null as any,
    employeeCode: 'NV001',
    fullName: 'Nguyễn Văn A',
    shortName: 'A',
    gradeId: '33333333-3333-3333-3333-333333333333',
    grade: null as any,
    departmentId: '44444444-4444-4444-4444-444444444444',
    department: null as any,
    jobTitle: 'Giáo viên',
    managementLevel: null,
    gender: Gender.MALE,
    maxPeriodsPerWeek: 20,
    status: TeacherStatus.ACTIVE,
    // Legacy fields - must still be present in response
    citizenId: '001234567890',
    dateOfBirth: '1985-05-15',
    phone: '0912345678',
    email: 'teacher@school.com',
    position: 'Giáo viên chính',
    teacherType: TeacherType.FULL_TIME,
    minPeriodsPerWeek: 10,
    maxPeriodsPerDay: 6,
    unavailableSlots: mockUnavailableSlots,
  };

  beforeEach(async () => {
    const mockTeacherRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockTeacherSubjectService = {
      getSubjectsMapForTeachers: jest.fn(),
      getSubjectsForTeacher: jest.fn(),
      assignSubjects: jest.fn(),
      removeAssignment: jest.fn(),
      getAssignmentsForTeacher: jest.fn(),
      hasAssignment: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherService,
        { provide: TeacherRepository, useValue: mockTeacherRepository },
        { provide: TeacherSubjectService, useValue: mockTeacherSubjectService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
    teacherRepository = module.get(TeacherRepository);
    teacherSubjectService = module.get(TeacherSubjectService);
    // eventEmitter is provided but only needed for internal service wiring
    module.get(EventEmitter2);
  });

  describe('findAll - backward compatibility (Requirement 7.3)', () => {
    it('should return ALL entity fields including legacy fields in response', async () => {
      // Arrange
      teacherRepository.findAll.mockResolvedValue([
        [mockTeacherWithLegacyData],
        1,
      ]);
      teacherSubjectService.getSubjectsMapForTeachers.mockResolvedValue(
        new Map([[mockTeacherWithLegacyData.id, []]]),
      );

      // Act
      const result = await service.findAll(
        { page: 1, limit: 10 } as any,
        '22222222-2222-2222-2222-222222222222',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      const teacher = result.data[0];

      // Standard fields present
      expect(teacher.schoolId).toBe('22222222-2222-2222-2222-222222222222');
      expect(teacher.employeeCode).toBe('NV001');
      expect(teacher.fullName).toBe('Nguyễn Văn A');
      expect(teacher.shortName).toBe('A');
      expect(teacher.gradeId).toBe('33333333-3333-3333-3333-333333333333');
      expect(teacher.departmentId).toBe('44444444-4444-4444-4444-444444444444');
      expect(teacher.jobTitle).toBe('Giáo viên');
      expect(teacher.gender).toBe(Gender.MALE);
      expect(teacher.maxPeriodsPerWeek).toBe(20);
      expect(teacher.status).toBe(TeacherStatus.ACTIVE);

      // Legacy fields MUST still be present in response
      expect(teacher.citizenId).toBe('001234567890');
      expect(teacher.dateOfBirth).toBe('1985-05-15');
      expect(teacher.phone).toBe('0912345678');
      expect(teacher.email).toBe('teacher@school.com');
      expect(teacher.position).toBe('Giáo viên chính');
      expect(teacher.teacherType).toBe(TeacherType.FULL_TIME);
      expect(teacher.minPeriodsPerWeek).toBe(10);
      expect(teacher.maxPeriodsPerDay).toBe(6);
      expect(teacher.unavailableSlots).toEqual(mockUnavailableSlots);
    });

    it('should preserve legacy fields structure in list response for teachers with legacy data', async () => {
      // Arrange
      teacherRepository.findAll.mockResolvedValue([
        [mockTeacherWithLegacyData],
        1,
      ]);
      teacherSubjectService.getSubjectsMapForTeachers.mockResolvedValue(
        new Map([[mockTeacherWithLegacyData.id, []]]),
      );

      // Act
      const result = await service.findAll(
        { page: 1, limit: 10 } as any,
        '22222222-2222-2222-2222-222222222222',
      );
      const teacher = result.data[0];

      // Assert - verify all legacy properties exist on the response object
      const legacyFields = [
        'citizenId',
        'dateOfBirth',
        'phone',
        'email',
        'position',
        'teacherType',
        'minPeriodsPerWeek',
        'maxPeriodsPerDay',
        'unavailableSlots',
      ];

      for (const field of legacyFields) {
        expect(teacher).toHaveProperty(field);
      }
    });
  });

  describe('findById - backward compatibility (Requirement 7.4)', () => {
    it('should return ALL entity fields including legacy fields when getting teacher by id', async () => {
      // Arrange
      teacherRepository.findById.mockResolvedValue(mockTeacherWithLegacyData);
      teacherSubjectService.getSubjectsForTeacher.mockResolvedValue([]);

      // Act
      const result: TeacherWithSubjects = await service.findById(
        mockTeacherWithLegacyData.id,
        '22222222-2222-2222-2222-222222222222',
      );

      // Assert - Standard fields
      expect(result.schoolId).toBe('22222222-2222-2222-2222-222222222222');
      expect(result.employeeCode).toBe('NV001');
      expect(result.fullName).toBe('Nguyễn Văn A');
      expect(result.shortName).toBe('A');
      expect(result.gradeId).toBe('33333333-3333-3333-3333-333333333333');
      expect(result.departmentId).toBe('44444444-4444-4444-4444-444444444444');
      expect(result.jobTitle).toBe('Giáo viên');
      expect(result.gender).toBe(Gender.MALE);
      expect(result.maxPeriodsPerWeek).toBe(20);
      expect(result.status).toBe(TeacherStatus.ACTIVE);

      // Assert - Legacy fields MUST still be present
      expect(result.citizenId).toBe('001234567890');
      expect(result.dateOfBirth).toBe('1985-05-15');
      expect(result.phone).toBe('0912345678');
      expect(result.email).toBe('teacher@school.com');
      expect(result.position).toBe('Giáo viên chính');
      expect(result.teacherType).toBe(TeacherType.FULL_TIME);
      expect(result.minPeriodsPerWeek).toBe(10);
      expect(result.maxPeriodsPerDay).toBe(6);
      expect(result.unavailableSlots).toEqual(mockUnavailableSlots);
    });

    it('should preserve unavailableSlots array structure in response', async () => {
      // Arrange
      teacherRepository.findById.mockResolvedValue(mockTeacherWithLegacyData);
      teacherSubjectService.getSubjectsForTeacher.mockResolvedValue([]);

      // Act
      const result = await service.findById(
        mockTeacherWithLegacyData.id,
        '22222222-2222-2222-2222-222222222222',
      );

      // Assert - verify unavailableSlots has correct structure
      expect(result.unavailableSlots).toBeInstanceOf(Array);
      expect(result.unavailableSlots).toHaveLength(1);
      expect(result.unavailableSlots![0]).toEqual({
        dayOfWeek: 2,
        periodId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });
    });

    it('should include all legacy fields as properties on the returned object', async () => {
      // Arrange
      teacherRepository.findById.mockResolvedValue(mockTeacherWithLegacyData);
      teacherSubjectService.getSubjectsForTeacher.mockResolvedValue([]);

      // Act
      const result = await service.findById(
        mockTeacherWithLegacyData.id,
        '22222222-2222-2222-2222-222222222222',
      );

      // Assert - verify all legacy properties exist
      const legacyFields = [
        'citizenId',
        'dateOfBirth',
        'phone',
        'email',
        'position',
        'teacherType',
        'minPeriodsPerWeek',
        'maxPeriodsPerDay',
        'unavailableSlots',
      ];

      for (const field of legacyFields) {
        expect(result).toHaveProperty(field);
      }
    });
  });
});
