import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MasterDataScopeGuard } from '../../../src/modules/master-data/guards/master-data-scope.guard';
import { MasterDataRepository } from '../../../src/modules/master-data/repositories/master-data.repository';
import { UserRole } from '../../../src/common/enums/role.enum';
import { EmployeeMasterEntity } from '../../../src/modules/master-data/entities/employee-master.entity';

describe('MasterDataScopeGuard', () => {
  let guard: MasterDataScopeGuard;
  let reflector: jest.Mocked<Reflector>;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;

  const SCHOOL_ID_A = 'school-aaa-1111';
  const SCHOOL_ID_B = 'school-bbb-2222';
  const EMPLOYEE_ID = 'emp-uuid-1111';
  const USER_ID = 'user-uuid-1111';

  const mockEmployee: Partial<EmployeeMasterEntity> = {
    id: EMPLOYEE_ID,
    schoolId: SCHOOL_ID_A,
    employeeCode: 'NV001',
    fullName: 'Nguyễn Văn A',
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;

    masterDataRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<MasterDataRepository>;

    guard = new MasterDataScopeGuard(reflector, masterDataRepository);
  });

  function createMockExecutionContext(
    user: {
      id: string;
      role: UserRole;
      schoolId: string | null;
      email?: string;
    } | null,
    params: Record<string, string> = {},
    query: Record<string, string> = {},
    body: Record<string, string> = {},
    method = 'GET',
  ): ExecutionContext {
    const request = {
      user,
      params,
      query,
      body,
      method,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  function mockWriteOperation(): void {
    reflector.getAllAndOverride.mockImplementation((key: unknown) => {
      if (key === 'master_data_write') return true;
      return false;
    });
  }

  function mockReconciliationOperation(): void {
    reflector.getAllAndOverride.mockImplementation((key: unknown) => {
      if (key === 'master_data_reconciliation') return true;
      return false;
    });
  }

  // ===================================================================
  // SUPER_ADMIN - Full access
  // ===================================================================
  describe('SUPER_ADMIN', () => {
    const superAdmin = {
      id: USER_ID,
      role: UserRole.SUPER_ADMIN,
      schoolId: null,
    };

    it('should allow access to any employee record', async () => {
      const context = createMockExecutionContext(superAdmin, {
        id: EMPLOYEE_ID,
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access with any schoolId', async () => {
      const context = createMockExecutionContext(
        superAdmin,
        {},
        { schoolId: SCHOOL_ID_A },
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow write operations', async () => {
      mockWriteOperation();
      const context = createMockExecutionContext(
        superAdmin,
        {},
        {},
        {},
        'POST',
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow reconciliation operations', async () => {
      mockReconciliationOperation();
      const context = createMockExecutionContext(superAdmin);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  // ===================================================================
  // SCHOOL_ADMIN - Own school only
  // ===================================================================
  describe('SCHOOL_ADMIN', () => {
    const schoolAdmin = {
      id: USER_ID,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: SCHOOL_ID_A,
    };

    it('should allow access to own school data', async () => {
      const context = createMockExecutionContext(
        schoolAdmin,
        {},
        { schoolId: SCHOOL_ID_A },
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw 403 when accessing another school data via query', async () => {
      const context = createMockExecutionContext(
        schoolAdmin,
        {},
        { schoolId: SCHOOL_ID_B },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền truy cập dữ liệu trường khác',
      );
    });

    it('should throw 403 when accessing another school data via params', async () => {
      const context = createMockExecutionContext(schoolAdmin, {
        schoolId: SCHOOL_ID_B,
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền truy cập dữ liệu trường khác',
      );
    });

    it('should throw 403 when accessing another school data via body', async () => {
      const context = createMockExecutionContext(
        schoolAdmin,
        {},
        {},
        { schoolId: SCHOOL_ID_B },
        'POST',
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền truy cập dữ liệu trường khác',
      );
    });

    it('should allow write operations for own school', async () => {
      mockWriteOperation();
      const context = createMockExecutionContext(
        schoolAdmin,
        {},
        {},
        { schoolId: SCHOOL_ID_A },
        'POST',
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow reconciliation operations', async () => {
      mockReconciliationOperation();
      const context = createMockExecutionContext(schoolAdmin);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should inject schoolId into query when not provided', async () => {
      const queryObj: Record<string, string> = {};
      const request = {
        user: schoolAdmin,
        params: {},
        query: queryObj,
        body: {},
        method: 'GET',
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);
      expect(queryObj['schoolId']).toBe(SCHOOL_ID_A);
    });
  });

  // ===================================================================
  // TEACHER - Own record only, read-only
  // ===================================================================
  describe('TEACHER', () => {
    const teacher = {
      id: USER_ID,
      role: UserRole.TEACHER,
      schoolId: SCHOOL_ID_A,
    };

    it('should throw 403 for write operations', async () => {
      mockWriteOperation();
      const context = createMockExecutionContext(teacher, {}, {}, {}, 'POST');
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền thực hiện thao tác này',
      );
    });

    it('should throw 403 for reconciliation operations', async () => {
      mockReconciliationOperation();
      const context = createMockExecutionContext(teacher);
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền thực hiện thao tác này',
      );
    });

    it('should allow GET to own school employee record', async () => {
      masterDataRepository.findById.mockResolvedValue(
        mockEmployee as EmployeeMasterEntity,
      );
      const context = createMockExecutionContext(teacher, { id: EMPLOYEE_ID });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw 403 when teacher tries to access record from another school', async () => {
      const otherSchoolEmployee = {
        ...mockEmployee,
        schoolId: SCHOOL_ID_B,
      };
      masterDataRepository.findById.mockResolvedValue(
        otherSchoolEmployee as EmployeeMasterEntity,
      );
      const context = createMockExecutionContext(teacher, { id: EMPLOYEE_ID });
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn chỉ có quyền xem thông tin của chính mình',
      );
    });

    it('should allow access when employee not found (let service handle 404)', async () => {
      masterDataRepository.findById.mockResolvedValue(null);
      const context = createMockExecutionContext(teacher, {
        id: 'nonexistent-id',
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should set teacher scope metadata on request for list endpoints', async () => {
      const request = {
        user: teacher,
        params: {} as Record<string, string>,
        query: {} as Record<string, string>,
        body: {} as Record<string, string>,
        method: 'GET',
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);
      expect(
        (request as Record<string, unknown>).__masterDataTeacherUserId,
      ).toBe(USER_ID);
    });

    it('should inject schoolId into query for teacher', async () => {
      const queryObj: Record<string, string> = {};
      const request = {
        user: teacher,
        params: {} as Record<string, string>,
        query: queryObj,
        body: {} as Record<string, string>,
        method: 'GET',
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);
      expect(queryObj['schoolId']).toBe(SCHOOL_ID_A);
    });
  });

  // ===================================================================
  // No user (unauthenticated) - let JwtAuthGuard handle
  // ===================================================================
  describe('No user', () => {
    it('should return true when no user (let JwtAuthGuard handle)', async () => {
      const context = createMockExecutionContext(null);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  // ===================================================================
  // Other roles (SCHEDULER, VIEWER) - school scope applied
  // ===================================================================
  describe('Other roles (SCHEDULER)', () => {
    const scheduler = {
      id: USER_ID,
      role: UserRole.SCHEDULER,
      schoolId: SCHOOL_ID_A,
    };

    it('should throw 403 for write operations', async () => {
      mockWriteOperation();
      const context = createMockExecutionContext(scheduler, {}, {}, {}, 'POST');
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền thực hiện thao tác này',
      );
    });

    it('should throw 403 for reconciliation operations', async () => {
      mockReconciliationOperation();
      const context = createMockExecutionContext(scheduler);
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền thực hiện thao tác này',
      );
    });

    it('should throw 403 when accessing another school', async () => {
      const context = createMockExecutionContext(
        scheduler,
        {},
        { schoolId: SCHOOL_ID_B },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Bạn không có quyền truy cập dữ liệu trường khác',
      );
    });

    it('should allow access to own school data', async () => {
      const context = createMockExecutionContext(
        scheduler,
        {},
        { schoolId: SCHOOL_ID_A },
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
