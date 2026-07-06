import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DepartmentController } from '../../../src/modules/department/department.controller';
import { DepartmentMemberController } from '../../../src/modules/department/department-member.controller';
import { DepartmentService } from '../../../src/modules/department/department.service';
import { DepartmentMemberService } from '../../../src/modules/department/department-member.service';
import { DepartmentMemberRepository } from '../../../src/modules/department/department-member.repository';
import { UserRepository } from '../../../src/modules/auth/user.repository';
import { UserRole } from '../../../src/common/enums/role.enum';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../src/common/guards/school-scope.guard';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { CurrentUserPayload } from '../../../src/common/decorators/current-user.decorator';

/**
 * Department Authorization Unit Tests
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 *
 * Tests role-based access control for Department and DepartmentMember operations:
 * - SUPER_ADMIN: full access cross-school
 * - SCHOOL_ADMIN: write access own school only
 * - SCHEDULER: read-only access
 * - TEACHER: read-only access limited to own departments
 * - Unauthenticated: 401 via JwtAuthGuard
 */

// --- Test Constants ---
const SCHOOL_A_ID = '11111111-1111-1111-1111-111111111111';
const SCHOOL_B_ID = '22222222-2222-2222-2222-222222222222';
const DEPARTMENT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const TEACHER_ID = 'tttttttt-tttt-tttt-tttt-tttttttttttt';
const MEMBER_ID = 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm';
const USER_ID = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu';

const mockDepartment = {
  id: DEPARTMENT_ID,
  schoolId: SCHOOL_A_ID,
  name: 'Tổ Toán',
  headTeacherId: null,
};

const mockPaginatedResult = {
  success: true,
  data: [mockDepartment],
  message: 'Lấy danh sách tổ bộ môn thành công',
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

const mockMemberPaginatedResult = {
  success: true,
  data: [],
  message: 'Lấy danh sách thành viên thành công',
  meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

describe('Department Authorization', () => {
  let departmentController: DepartmentController;
  let memberController: DepartmentMemberController;
  let departmentService: jest.Mocked<DepartmentService>;
  let memberService: jest.Mocked<DepartmentMemberService>;
  let memberRepository: jest.Mocked<DepartmentMemberRepository>;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const mockDepartmentService = {
      findAll: jest.fn(),
      findAllByIds: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockMemberService = {
      addMember: jest.fn(),
      removeMember: jest.fn(),
      listMembers: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      batchUpdate: jest.fn(),
    };

    const mockMemberRepository = {
      findDepartmentIdsByTeacher: jest.fn(),
      findByDepartment: jest.fn(),
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      findAllFiltered: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentController, DepartmentMemberController],
      providers: [
        { provide: DepartmentService, useValue: mockDepartmentService },
        { provide: DepartmentMemberService, useValue: mockMemberService },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepository },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    departmentController =
      module.get<DepartmentController>(DepartmentController);
    memberController = module.get<DepartmentMemberController>(
      DepartmentMemberController,
    );
    departmentService = module.get(
      DepartmentService,
    ) as jest.Mocked<DepartmentService>;
    memberService = module.get(
      DepartmentMemberService,
    ) as jest.Mocked<DepartmentMemberService>;
    memberRepository = module.get(
      DepartmentMemberRepository,
    ) as jest.Mocked<DepartmentMemberRepository>;
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  // ===================================================================
  // SUPER_ADMIN access (Requirement 6.6)
  // ===================================================================
  describe('SUPER_ADMIN access', () => {
    const superAdminUser: CurrentUserPayload = {
      id: USER_ID,
      email: 'admin@system.com',
      role: UserRole.SUPER_ADMIN,
      schoolId: null,
    };

    it('should access findAll departments with schoolScope = null (cross-school)', async () => {
      departmentService.findAll.mockResolvedValue(mockPaginatedResult as never);

      const result = await departmentController.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' } as never,
        null, // schoolScope = null for SUPER_ADMIN
        superAdminUser,
      );

      expect(departmentService.findAll).toHaveBeenCalledWith(
        expect.anything(),
        null,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should access findById for any department regardless of school', async () => {
      departmentService.findById.mockResolvedValue(mockDepartment as never);

      const result = await departmentController.findById(
        DEPARTMENT_ID,
        null, // no school scope
        superAdminUser,
      );

      expect(result).toEqual(mockDepartment);
    });

    it('should create department with schoolScope = null', async () => {
      departmentService.create.mockResolvedValue(mockDepartment as never);

      const result = await departmentController.create(
        { name: 'Tổ Toán', schoolId: SCHOOL_A_ID },
        null,
      );

      expect(departmentService.create).toHaveBeenCalledWith(
        { name: 'Tổ Toán', schoolId: SCHOOL_A_ID },
        null,
      );
      expect(result).toEqual(mockDepartment);
    });

    it('should add member to any department (cross-school)', async () => {
      const mockMember = {
        id: MEMBER_ID,
        departmentId: DEPARTMENT_ID,
        teacherId: TEACHER_ID,
      };
      memberService.addMember.mockResolvedValue(mockMember as never);

      const result = await memberController.addMember(
        DEPARTMENT_ID,
        { teacherId: TEACHER_ID },
        null, // schoolScope = null
      );

      expect(memberService.addMember).toHaveBeenCalledWith(
        DEPARTMENT_ID,
        { teacherId: TEACHER_ID },
        null,
      );
      expect(result).toEqual(mockMember);
    });

    it('should list members of any department (cross-school)', async () => {
      memberService.listMembers.mockResolvedValue(
        mockMemberPaginatedResult as never,
      );

      const result = await memberController.listMembers(
        DEPARTMENT_ID,
        { page: 1, limit: 10, sortOrder: 'ASC' } as never,
        null,
        superAdminUser,
      );

      expect(result).toEqual(mockMemberPaginatedResult);
    });
  });

  // ===================================================================
  // SCHOOL_ADMIN access (Requirement 6.1, 6.5)
  // ===================================================================
  describe('SCHOOL_ADMIN access', () => {
    const schoolAdminUser: CurrentUserPayload = {
      id: USER_ID,
      email: 'admin@schoola.com',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: SCHOOL_A_ID,
    };

    it('should access findAll with schoolScope = own schoolId', async () => {
      departmentService.findAll.mockResolvedValue(mockPaginatedResult as never);

      const result = await departmentController.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' } as never,
        SCHOOL_A_ID, // schoolScope = own school
        schoolAdminUser,
      );

      expect(departmentService.findAll).toHaveBeenCalledWith(
        expect.anything(),
        SCHOOL_A_ID,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should access findById for own school department', async () => {
      departmentService.findById.mockResolvedValue(mockDepartment as never);

      const result = await departmentController.findById(
        DEPARTMENT_ID,
        SCHOOL_A_ID,
        schoolAdminUser,
      );

      expect(result).toEqual(mockDepartment);
    });

    it('should reject findById for different school department (returns 404)', async () => {
      const otherSchoolDepartment = {
        ...mockDepartment,
        schoolId: SCHOOL_B_ID,
      };
      departmentService.findById.mockResolvedValue(
        otherSchoolDepartment as never,
      );

      await expect(
        departmentController.findById(
          DEPARTMENT_ID,
          SCHOOL_A_ID,
          schoolAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create department scoped to own school', async () => {
      departmentService.create.mockResolvedValue(mockDepartment as never);

      await departmentController.create(
        { name: 'Tổ Lý', schoolId: SCHOOL_A_ID },
        SCHOOL_A_ID,
      );

      expect(departmentService.create).toHaveBeenCalledWith(
        { name: 'Tổ Lý', schoolId: SCHOOL_A_ID },
        SCHOOL_A_ID,
      );
    });

    it('should add member with schoolScope = own schoolId', async () => {
      const mockMember = {
        id: MEMBER_ID,
        departmentId: DEPARTMENT_ID,
        teacherId: TEACHER_ID,
      };
      memberService.addMember.mockResolvedValue(mockMember as never);

      const result = await memberController.addMember(
        DEPARTMENT_ID,
        { teacherId: TEACHER_ID },
        SCHOOL_A_ID,
      );

      expect(memberService.addMember).toHaveBeenCalledWith(
        DEPARTMENT_ID,
        { teacherId: TEACHER_ID },
        SCHOOL_A_ID,
      );
      expect(result).toEqual(mockMember);
    });

    it('should remove member with schoolScope = own schoolId', async () => {
      memberService.removeMember.mockResolvedValue(undefined);

      const result = await memberController.removeMember(
        DEPARTMENT_ID,
        MEMBER_ID,
        SCHOOL_A_ID,
      );

      expect(memberService.removeMember).toHaveBeenCalledWith(
        DEPARTMENT_ID,
        MEMBER_ID,
        SCHOOL_A_ID,
      );
      expect(result).toEqual({ message: 'Xóa thành viên thành công' });
    });

    it('should update position with schoolScope = own schoolId', async () => {
      const mockMember = { id: MEMBER_ID, positionTitle: 'GVCN' };
      memberService.updatePositionTitle.mockResolvedValue(mockMember as never);

      await memberController.updatePosition(
        DEPARTMENT_ID,
        MEMBER_ID,
        { positionTitle: 'GVCN' } as never,
        SCHOOL_A_ID,
      );

      expect(memberService.updatePositionTitle).toHaveBeenCalledWith(
        DEPARTMENT_ID,
        MEMBER_ID,
        { positionTitle: 'GVCN' },
        SCHOOL_A_ID,
      );
    });

    it('should reject update for department in different school (via service 404)', async () => {
      departmentService.findById.mockResolvedValue({
        ...mockDepartment,
        schoolId: SCHOOL_B_ID,
      } as never);

      await expect(
        departmentController.update(
          DEPARTMENT_ID,
          { name: 'New' },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================================================================
  // SCHEDULER access (Requirement 6.2)
  // ===================================================================
  describe('SCHEDULER access', () => {
    const schedulerUser: CurrentUserPayload = {
      id: USER_ID,
      email: 'scheduler@schoola.com',
      role: UserRole.SCHEDULER,
      schoolId: SCHOOL_A_ID,
    };

    it('should access findAll departments (read-only)', async () => {
      departmentService.findAll.mockResolvedValue(mockPaginatedResult as never);

      const result = await departmentController.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' } as never,
        SCHOOL_A_ID,
        schedulerUser,
      );

      expect(departmentService.findAll).toHaveBeenCalledWith(
        expect.anything(),
        SCHOOL_A_ID,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should access listMembers (read-only)', async () => {
      memberService.listMembers.mockResolvedValue(
        mockMemberPaginatedResult as never,
      );

      const result = await memberController.listMembers(
        DEPARTMENT_ID,
        { page: 1, limit: 10, sortOrder: 'ASC' } as never,
        SCHOOL_A_ID,
        schedulerUser,
      );

      expect(memberService.listMembers).toHaveBeenCalledWith(
        DEPARTMENT_ID,
        expect.anything(),
        SCHOOL_A_ID,
      );
      expect(result).toEqual(mockMemberPaginatedResult);
    });
  });

  // ===================================================================
  // TEACHER access (Requirement 6.3)
  // ===================================================================
  describe('TEACHER access', () => {
    const teacherUser: CurrentUserPayload = {
      id: USER_ID,
      email: 'teacher@schoola.com',
      role: UserRole.TEACHER,
      schoolId: SCHOOL_A_ID,
    };

    it('should access findAll but only returns own departments', async () => {
      const userRecord = { id: USER_ID, teacherId: TEACHER_ID } as never;
      userRepository.findById.mockResolvedValue(userRecord);
      memberRepository.findDepartmentIdsByTeacher.mockResolvedValue([
        DEPARTMENT_ID,
      ]);
      departmentService.findAllByIds.mockResolvedValue(
        mockPaginatedResult as never,
      );

      const result = await departmentController.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' } as never,
        SCHOOL_A_ID,
        teacherUser,
      );

      expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
      expect(memberRepository.findDepartmentIdsByTeacher).toHaveBeenCalledWith(
        TEACHER_ID,
      );
      expect(departmentService.findAllByIds).toHaveBeenCalledWith(
        [DEPARTMENT_ID],
        expect.anything(),
        SCHOOL_A_ID,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should throw ForbiddenException on findAll if user has no teacherId', async () => {
      const userRecord = { id: USER_ID, teacherId: null } as never;
      userRepository.findById.mockResolvedValue(userRecord);

      await expect(
        departmentController.findAll(
          { page: 1, limit: 10, sortOrder: 'ASC' } as never,
          SCHOOL_A_ID,
          teacherUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should access findById for a department teacher belongs to', async () => {
      departmentService.findById.mockResolvedValue(mockDepartment as never);
      const userRecord = { id: USER_ID, teacherId: TEACHER_ID } as never;
      userRepository.findById.mockResolvedValue(userRecord);
      memberRepository.findDepartmentIdsByTeacher.mockResolvedValue([
        DEPARTMENT_ID,
      ]);

      const result = await departmentController.findById(
        DEPARTMENT_ID,
        SCHOOL_A_ID,
        teacherUser,
      );

      expect(result).toEqual(mockDepartment);
    });

    it('should throw ForbiddenException on findById for department teacher does NOT belong to', async () => {
      departmentService.findById.mockResolvedValue(mockDepartment as never);
      const userRecord = { id: USER_ID, teacherId: TEACHER_ID } as never;
      userRepository.findById.mockResolvedValue(userRecord);
      memberRepository.findDepartmentIdsByTeacher.mockResolvedValue([]); // teacher not in this department

      await expect(
        departmentController.findById(DEPARTMENT_ID, SCHOOL_A_ID, teacherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException on findById if teacher user has no teacherId', async () => {
      departmentService.findById.mockResolvedValue(mockDepartment as never);
      const userRecord = { id: USER_ID, teacherId: null } as never;
      userRepository.findById.mockResolvedValue(userRecord);

      await expect(
        departmentController.findById(DEPARTMENT_ID, SCHOOL_A_ID, teacherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should access listMembers for a department teacher belongs to', async () => {
      const userRecord = { id: USER_ID, teacherId: TEACHER_ID } as never;
      userRepository.findById.mockResolvedValue(userRecord);
      memberRepository.findDepartmentIdsByTeacher.mockResolvedValue([
        DEPARTMENT_ID,
      ]);
      memberService.listMembers.mockResolvedValue(
        mockMemberPaginatedResult as never,
      );

      const result = await memberController.listMembers(
        DEPARTMENT_ID,
        { page: 1, limit: 10, sortOrder: 'ASC' } as never,
        SCHOOL_A_ID,
        teacherUser,
      );

      expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
      expect(memberRepository.findDepartmentIdsByTeacher).toHaveBeenCalledWith(
        TEACHER_ID,
      );
      expect(memberService.listMembers).toHaveBeenCalledWith(
        DEPARTMENT_ID,
        expect.anything(),
        SCHOOL_A_ID,
      );
      expect(result).toEqual(mockMemberPaginatedResult);
    });

    it('should throw ForbiddenException on listMembers for department teacher does NOT belong to', async () => {
      const userRecord = { id: USER_ID, teacherId: TEACHER_ID } as never;
      userRepository.findById.mockResolvedValue(userRecord);
      memberRepository.findDepartmentIdsByTeacher.mockResolvedValue([]); // not a member

      await expect(
        memberController.listMembers(
          DEPARTMENT_ID,
          { page: 1, limit: 10, sortOrder: 'ASC' } as never,
          SCHOOL_A_ID,
          teacherUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException on listMembers if teacher user has no teacherId', async () => {
      const userRecord = { id: USER_ID, teacherId: null } as never;
      userRepository.findById.mockResolvedValue(userRecord);

      await expect(
        memberController.listMembers(
          DEPARTMENT_ID,
          { page: 1, limit: 10, sortOrder: 'ASC' } as never,
          SCHOOL_A_ID,
          teacherUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===================================================================
  // RolesGuard behavior (Requirement 6.1, 6.4)
  // ===================================================================
  describe('RolesGuard - write operations restricted to SUPER_ADMIN/SCHOOL_ADMIN', () => {
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    it('should allow SUPER_ADMIN access to write endpoints', () => {
      const mockContext = createMockExecutionContext(UserRole.SUPER_ADMIN);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN]);

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('should allow SCHOOL_ADMIN access to write endpoints', () => {
      const mockContext = createMockExecutionContext(UserRole.SCHOOL_ADMIN);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN]);

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('should deny SCHEDULER access to write endpoints', () => {
      const mockContext = createMockExecutionContext(UserRole.SCHEDULER);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN]);

      expect(rolesGuard.canActivate(mockContext)).toBe(false);
    });

    it('should deny TEACHER access to write endpoints', () => {
      const mockContext = createMockExecutionContext(UserRole.TEACHER);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN]);

      expect(rolesGuard.canActivate(mockContext)).toBe(false);
    });

    it('should allow all listed roles on read endpoints', () => {
      const readRoles = [
        UserRole.SUPER_ADMIN,
        UserRole.SCHOOL_ADMIN,
        UserRole.SCHEDULER,
        UserRole.TEACHER,
      ];
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(readRoles);

      for (const role of readRoles) {
        const mockContext = createMockExecutionContext(role);
        expect(rolesGuard.canActivate(mockContext)).toBe(true);
      }
    });

    it('should deny VIEWER access to both read and write member endpoints', () => {
      const mockContext = createMockExecutionContext(UserRole.VIEWER);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          UserRole.SUPER_ADMIN,
          UserRole.SCHOOL_ADMIN,
          UserRole.SCHEDULER,
          UserRole.TEACHER,
        ]);

      expect(rolesGuard.canActivate(mockContext)).toBe(false);
    });
  });

  // ===================================================================
  // SchoolScopeGuard behavior (Requirement 6.5, 6.6, 7.1)
  // ===================================================================
  describe('SchoolScopeGuard - school scope assignment', () => {
    let schoolScopeGuard: SchoolScopeGuard;

    beforeEach(() => {
      schoolScopeGuard = new SchoolScopeGuard();
    });

    it('should set schoolScope = null for SUPER_ADMIN', async () => {
      const request = {
        user: { id: USER_ID, role: UserRole.SUPER_ADMIN, schoolId: null },
      } as never;
      const mockContext = createMockContextWithRequest(request);

      const result = await schoolScopeGuard.canActivate(mockContext);

      expect(result).toBe(true);
      expect((request as Record<string, unknown>).schoolScope).toBeNull();
    });

    it('should set schoolScope = user.schoolId for SCHOOL_ADMIN', async () => {
      const request = {
        user: {
          id: USER_ID,
          role: UserRole.SCHOOL_ADMIN,
          schoolId: SCHOOL_A_ID,
        },
      } as never;
      const mockContext = createMockContextWithRequest(request);

      const result = await schoolScopeGuard.canActivate(mockContext);

      expect(result).toBe(true);
      expect((request as Record<string, unknown>).schoolScope).toEqual([
        SCHOOL_A_ID,
      ]);
    });

    it('should set schoolScope = user.schoolId for SCHEDULER', async () => {
      const request = {
        user: { id: USER_ID, role: UserRole.SCHEDULER, schoolId: SCHOOL_A_ID },
      } as never;
      const mockContext = createMockContextWithRequest(request);

      const result = await schoolScopeGuard.canActivate(mockContext);

      expect(result).toBe(true);
      expect((request as Record<string, unknown>).schoolScope).toEqual([
        SCHOOL_A_ID,
      ]);
    });

    it('should set schoolScope = user.schoolId for TEACHER', async () => {
      const request = {
        user: { id: USER_ID, role: UserRole.TEACHER, schoolId: SCHOOL_A_ID },
      } as never;
      const mockContext = createMockContextWithRequest(request);

      const result = await schoolScopeGuard.canActivate(mockContext);

      expect(result).toBe(true);
      expect((request as Record<string, unknown>).schoolScope).toEqual([
        SCHOOL_A_ID,
      ]);
    });

    it('should pass through if no user (let JwtAuthGuard handle 401)', async () => {
      const request = { user: undefined } as never;
      const mockContext = createMockContextWithRequest(request);

      const result = await schoolScopeGuard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  // ===================================================================
  // Unauthenticated access (Requirement 6.7)
  // ===================================================================
  describe('Unauthenticated access', () => {
    it('JwtAuthGuard should be applied to DepartmentController', () => {
      const guards = Reflect.getMetadata('__guards__', DepartmentController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('JwtAuthGuard should be applied to DepartmentMemberController', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        DepartmentMemberController,
      );
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('RolesGuard should be applied to DepartmentController', () => {
      const guards = Reflect.getMetadata('__guards__', DepartmentController);
      expect(guards).toContain(RolesGuard);
    });

    it('RolesGuard should be applied to DepartmentMemberController', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        DepartmentMemberController,
      );
      expect(guards).toContain(RolesGuard);
    });

    it('SchoolScopeGuard should be applied to DepartmentController', () => {
      const guards = Reflect.getMetadata('__guards__', DepartmentController);
      expect(guards).toContain(SchoolScopeGuard);
    });

    it('SchoolScopeGuard should be applied to DepartmentMemberController', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        DepartmentMemberController,
      );
      expect(guards).toContain(SchoolScopeGuard);
    });
  });
});

// --- Helper Functions ---

function createMockExecutionContext(role: UserRole) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'user-id', role, schoolId: SCHOOL_A_ID },
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

function createMockContextWithRequest(request: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}
