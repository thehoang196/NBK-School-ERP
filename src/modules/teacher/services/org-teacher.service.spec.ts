import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrgTeacherService } from './org-teacher.service';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { TeacherEntity } from '../entities/teacher.entity';
import { TeacherSchoolAssignmentEntity } from '../../teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentRole } from '../../teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../teacher-school-assignment/enums/assignment-status.enum';
import { TeacherType, TeacherStatus } from '../../../common/enums/status.enum';

describe('OrgTeacherService', () => {
  let service: OrgTeacherService;
  let mockDataSource: Partial<DataSource>;
  let mockAssignmentService: Partial<TeacherSchoolAssignmentService>;
  let mockQueryBuilder: Record<string, jest.Mock>;
  let mockRepository: Record<string, jest.Mock>;

  const createMockTeacher = (
    overrides: Partial<TeacherEntity> = {},
  ): TeacherEntity =>
    ({
      id: 'teacher-1',
      schoolId: 'school-1',
      employeeCode: 'GV001',
      fullName: 'Nguyễn Văn A',
      shortName: 'A',
      teacherType: TeacherType.FULL_TIME,
      status: TeacherStatus.ACTIVE,
      maxPeriodsPerWeek: 20,
      minPeriodsPerWeek: 10,
      maxPeriodsPerDay: 6,
      departmentId: 'dept-1',
      email: 'a@example.com',
      phone: '0901234567',
      jobTitle: 'Giáo viên',
      citizenId: null,
      gender: null,
      dateOfBirth: null,
      gradeId: null,
      managementLevel: null,
      position: null,
      unavailableSlots: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
      school: { id: 'school-1', name: 'Trường A', code: 'TA' } as never,
      department: { id: 'dept-1', name: 'Tổ Toán' } as never,
      grade: null as never,
      ...overrides,
    }) as TeacherEntity;

  const createMockAssignment = (
    overrides: Partial<TeacherSchoolAssignmentEntity> = {},
  ): TeacherSchoolAssignmentEntity =>
    ({
      id: 'assign-1',
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      role: AssignmentRole.PRIMARY,
      status: AssignmentStatus.ACTIVE,
      effectiveStartDate: '2024-01-01',
      effectiveEndDate: null,
      note: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
      teacher: {} as never,
      school: { id: 'school-1', name: 'Trường A', code: 'TA' } as never,
      ...overrides,
    }) as TeacherSchoolAssignmentEntity;

  beforeEach(() => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    mockAssignmentService = {
      findByTeacher: jest.fn().mockResolvedValue([]),
    };

    service = new OrgTeacherService(
      mockDataSource as DataSource,
      mockAssignmentService as TeacherSchoolAssignmentService,
    );
  });

  describe('findAll', () => {
    it('should return empty paginated list when no teachers exist', async () => {
      const query = { page: 1, limit: 20, sortOrder: 'DESC' as const };

      const result = await service.findAll(query, undefined, true);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(0);
      expect(result.message).toBe('Lấy danh sách giáo viên tổ chức thành công');
    });

    it('should return teachers with assignment data for SUPER_ADMIN', async () => {
      const teacher = createMockTeacher();
      const assignment = createMockAssignment();

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[teacher], 1]);
      (mockAssignmentService.findByTeacher as jest.Mock).mockResolvedValue([
        assignment,
      ]);

      const query = { page: 1, limit: 20, sortOrder: 'DESC' as const };
      const result = await service.findAll(query, undefined, true);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('teacher-1');
      expect(result.data[0].fullName).toBe('Nguyễn Văn A');
      expect(result.data[0].primarySchoolId).toBe('school-1');
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply schoolId scope filter for SCHOOL_ADMIN', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const query = { page: 1, limit: 20, sortOrder: 'DESC' as const };
      await service.findAll(query, 'school-admin', false);

      // Should add andWhere for SCHOOL_ADMIN scope
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      const callArgs = mockQueryBuilder.andWhere.mock.calls[0];
      expect(callArgs[0]).toContain('teacher.schoolId = :userSchoolId');
      expect(callArgs[1]).toEqual(
        expect.objectContaining({ userSchoolId: 'school-admin' }),
      );
    });

    it('should apply teacherType filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const query = {
        page: 1,
        limit: 20,
        sortOrder: 'DESC' as const,
        teacherType: TeacherType.INTER_SCHOOL,
      };
      await service.findAll(query, undefined, true);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'teacher.teacherType = :teacherType',
        { teacherType: TeacherType.INTER_SCHOOL },
      );
    });

    it('should apply hasCrossSchool=true filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const query = {
        page: 1,
        limit: 20,
        sortOrder: 'DESC' as const,
        hasCrossSchool: true,
      };
      await service.findAll(query, undefined, true);

      const calls = mockQueryBuilder.andWhere.mock.calls;
      const crossSchoolCall = calls.find(
        (call: [string, Record<string, unknown>]) =>
          call[0].includes('tsa3.role = :secondaryRole'),
      );
      expect(crossSchoolCall).toBeDefined();
    });

    it('should apply search filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const query = {
        page: 1,
        limit: 20,
        sortOrder: 'DESC' as const,
        search: 'nguyen',
      };
      await service.findAll(query, undefined, true);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(teacher.fullName ILIKE :search OR teacher.employeeCode ILIKE :search)',
        { search: '%nguyen%' },
      );
    });

    it('should indicate hasCrossSchool when teacher has secondary assignments', async () => {
      const teacher = createMockTeacher();
      const primaryAssignment = createMockAssignment({
        role: AssignmentRole.PRIMARY,
      });
      const secondaryAssignment = createMockAssignment({
        id: 'assign-2',
        schoolId: 'school-2',
        role: AssignmentRole.SECONDARY,
        school: { id: 'school-2', name: 'Trường B', code: 'TB' } as never,
      });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[teacher], 1]);
      (mockAssignmentService.findByTeacher as jest.Mock).mockResolvedValue([
        primaryAssignment,
        secondaryAssignment,
      ]);

      const query = { page: 1, limit: 20, sortOrder: 'DESC' as const };
      const result = await service.findAll(query, undefined, true);

      expect(result.data[0].hasCrossSchool).toBe(true);
      expect(result.data[0].schoolCount).toBe(2);
      expect(result.data[0].assignments).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when teacher does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent', undefined, true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return teacher detail with assignment history for SUPER_ADMIN', async () => {
      const teacher = createMockTeacher();
      const activeAssignment = createMockAssignment();
      const inactiveAssignment = createMockAssignment({
        id: 'assign-old',
        status: AssignmentStatus.INACTIVE,
        schoolId: 'school-old',
        school: { id: 'school-old', name: 'Trường Cũ', code: 'TC' } as never,
      });

      mockRepository.findOne.mockResolvedValue(teacher);
      (mockAssignmentService.findByTeacher as jest.Mock).mockResolvedValue([
        activeAssignment,
        inactiveAssignment,
      ]);

      const result = await service.findOne('teacher-1', undefined, true);

      expect(result.id).toBe('teacher-1');
      expect(result.fullName).toBe('Nguyễn Văn A');
      expect(result.email).toBe('a@example.com');
      expect(result.maxPeriodsPerWeek).toBe(20);
      expect(result.assignments).toHaveLength(1); // only active
      expect(result.assignmentHistory).toHaveLength(2); // all including inactive
    });

    it('should deny SCHOOL_ADMIN access to teacher not in their school', async () => {
      const teacher = createMockTeacher({ schoolId: 'school-other' });
      mockRepository.findOne.mockResolvedValue(teacher);
      (mockAssignmentService.findByTeacher as jest.Mock).mockResolvedValue([]);

      await expect(
        service.findOne('teacher-1', 'school-mine', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow SCHOOL_ADMIN access to teacher with cross-school assignment to their school', async () => {
      const teacher = createMockTeacher({ schoolId: 'school-other' });
      const crossAssignment = createMockAssignment({
        schoolId: 'school-mine',
        role: AssignmentRole.SECONDARY,
        school: { id: 'school-mine', name: 'Trường Tôi', code: 'TT' } as never,
      });

      mockRepository.findOne.mockResolvedValue(teacher);
      // First call for checkSchoolAdminAccess (includeInactive=false)
      // Second call for getting all assignments (includeInactive=true)
      (mockAssignmentService.findByTeacher as jest.Mock)
        .mockResolvedValueOnce([crossAssignment]) // checkSchoolAdminAccess
        .mockResolvedValueOnce([crossAssignment]); // findOne assignments

      const result = await service.findOne('teacher-1', 'school-mine', false);

      expect(result.id).toBe('teacher-1');
    });
  });
});
