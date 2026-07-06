import { Test, TestingModule } from '@nestjs/testing';
import { TeacherSubjectController } from './teacher-subject.controller';
import { TeacherSubjectService } from './teacher-subject.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/role.enum';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { TeacherSubjectEntity } from './entities/teacher-subject.entity';

describe('TeacherSubjectController', () => {
  let controller: TeacherSubjectController;
  let service: jest.Mocked<TeacherSubjectService>;

  const mockAssignment: Partial<TeacherSubjectEntity> = {
    id: 'assignment-uuid-1',
    teacherId: 'teacher-uuid-1',
    subjectId: 'subject-uuid-1',
    subject: {
      id: 'subject-uuid-1',
      name: 'Toán',
      code: 'MATH',
      schoolId: 'school-uuid-1',
    } as never,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockService = {
      assignSubjects: jest.fn(),
      getAssignmentsForTeacher: jest.fn(),
      removeAssignment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherSubjectController],
      providers: [
        {
          provide: TeacherSubjectService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<TeacherSubjectController>(TeacherSubjectController);
    service = module.get(TeacherSubjectService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Guards applied at controller level', () => {
    it('should have JwtAuthGuard and RolesGuard applied', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        TeacherSubjectController,
      );
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });
  });

  describe('POST /api/v1/teachers/:teacherId/subjects (assign)', () => {
    it('should call service.assignSubjects and return proper response format', async () => {
      const assignments = [mockAssignment as TeacherSubjectEntity];
      service.assignSubjects.mockResolvedValue(assignments);

      const result = await controller.assign('teacher-uuid-1', {
        subjectIds: ['subject-uuid-1'],
      });

      expect(service.assignSubjects).toHaveBeenCalledWith('teacher-uuid-1', [
        'subject-uuid-1',
      ]);
      expect(result).toEqual({
        success: true,
        data: assignments,
        message: 'Gán môn học giảng dạy thành công',
      });
    });

    it('should have correct response structure with success, data, message', async () => {
      service.assignSubjects.mockResolvedValue([]);

      const result = await controller.assign('teacher-uuid-1', {
        subjectIds: [] as string[],
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
    });

    it('should have Roles decorator with SUPER_ADMIN and SCHOOL_ADMIN', () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        TeacherSubjectController.prototype.assign,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.SCHOOL_ADMIN);
      expect(roles).not.toContain(UserRole.SCHEDULER);
    });
  });

  describe('GET /api/v1/teachers/:teacherId/subjects (findAll)', () => {
    it('should call service.getAssignmentsForTeacher and return proper response format', async () => {
      const links = [mockAssignment as TeacherSubjectEntity];
      service.getAssignmentsForTeacher.mockResolvedValue(links);

      const result = await controller.findAll('teacher-uuid-1');

      expect(service.getAssignmentsForTeacher).toHaveBeenCalledWith(
        'teacher-uuid-1',
      );
      expect(result).toEqual({
        success: true,
        data: [
          {
            id: 'assignment-uuid-1',
            subjectId: 'subject-uuid-1',
            subject: mockAssignment.subject,
          },
        ],
        message: 'Lấy danh sách môn học giảng dạy thành công',
      });
    });

    it('should have correct response structure with success, data, message', async () => {
      service.getAssignmentsForTeacher.mockResolvedValue([]);

      const result = await controller.findAll('teacher-uuid-1');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should have Roles decorator with SUPER_ADMIN, SCHOOL_ADMIN, and SCHEDULER', () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        TeacherSubjectController.prototype.findAll,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.SCHOOL_ADMIN);
      expect(roles).toContain(UserRole.SCHEDULER);
    });
  });

  describe('DELETE /api/v1/teachers/:teacherId/subjects/:assignmentId (remove)', () => {
    it('should call service.removeAssignment and return proper response format', async () => {
      service.removeAssignment.mockResolvedValue(undefined);

      const result = await controller.remove(
        'teacher-uuid-1',
        'assignment-uuid-1',
      );

      expect(service.removeAssignment).toHaveBeenCalledWith(
        'teacher-uuid-1',
        'assignment-uuid-1',
      );
      expect(result).toEqual({
        success: true,
        data: null,
        message: 'Gỡ môn học giảng dạy thành công',
      });
    });

    it('should have correct response structure with success, data as null, message', async () => {
      service.removeAssignment.mockResolvedValue(undefined);

      const result = await controller.remove(
        'teacher-uuid-1',
        'assignment-uuid-1',
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data', null);
      expect(result).toHaveProperty('message');
    });

    it('should have Roles decorator with SUPER_ADMIN and SCHOOL_ADMIN', () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        TeacherSubjectController.prototype.remove,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.SCHOOL_ADMIN);
      expect(roles).not.toContain(UserRole.SCHEDULER);
    });
  });
});
