import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
}));

import { ContextService, ContextJwtUser } from '../../../src/modules/context/services/context.service';
import { ContextSessionService } from '../../../src/modules/context/services/context-session.service';
import { TenantMiddleware } from '../../../src/common/tenant/tenant.middleware';
import { TenantContextService } from '../../../src/common/tenant/tenant-context.service';
import { TenantAuditService } from '../../../src/common/tenant/tenant-audit.service';
import { TenantRlsService } from '../../../src/common/tenant/tenant-rls.service';
import { SchoolEntity } from '../../../src/modules/school/entities/school.entity';
import { SchoolRepository } from '../../../src/modules/school/school.repository';
import { CacheService } from '../../../src/modules/cache/cache.service';
import { AuditLogService } from '../../../src/modules/audit/services/audit-log.service';
import { TeacherSchoolAssignmentService } from '../../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { UserRole } from '../../../src/common/enums/role.enum';
import { SchoolStatus } from '../../../src/common/enums/status.enum';
import {
  ContextForbiddenException,
  GlobalViewForbiddenException,
  GlobalViewReadonlyException,
} from '../../../src/modules/context/exceptions/context.exceptions';

// ─── Test Constants ─────────────────────────────────────────────────────────

const SCHOOL_A_ID = 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa';
const SCHOOL_B_ID = 'bbbbbbbb-2222-4bbb-bbbb-bbbbbbbbbbbb';
const SCHOOL_C_ID = 'cccccccc-3333-4ccc-cccc-cccccccccccc';
const COMPANY_ID = 'dddddddd-4444-4ddd-dddd-dddddddddddd';
const USER_ID_TEACHER = 'user-teacher-0001';
const USER_ID_SUPER = 'user-super-admin-0001';
const USER_ID_SCHOOL_ADMIN = 'user-school-admin-0001';

// ─── Test Data Factories ────────────────────────────────────────────────────

function createMockSchool(overrides: Partial<SchoolEntity> = {}): SchoolEntity {
  return {
    id: SCHOOL_A_ID,
    code: 'TH01',
    name: 'Trường Tiểu học Nguyễn Bỉnh Khiêm',
    address: null,
    phone: null,
    email: null,
    principalName: null,
    parentSchoolId: COMPANY_ID,
    parentSchool: null,
    childSchools: [],
    status: SchoolStatus.ACTIVE,
    schoolId: SCHOOL_A_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  } as SchoolEntity;
}

function createTeacherUser(overrides: Partial<ContextJwtUser> = {}): ContextJwtUser {
  return {
    id: USER_ID_TEACHER,
    email: 'teacher@nbk.edu.vn',
    role: UserRole.TEACHER,
    schoolId: SCHOOL_A_ID,
    accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
    companySchoolId: null,
    ...overrides,
  };
}

function createSuperAdminUser(overrides: Partial<ContextJwtUser> = {}): ContextJwtUser {
  return {
    id: USER_ID_SUPER,
    email: 'admin@nbk.edu.vn',
    role: UserRole.SUPER_ADMIN,
    schoolId: null,
    accessibleSchoolIds: [],
    companySchoolId: null,
    ...overrides,
  };
}

function createSchoolAdminUser(overrides: Partial<ContextJwtUser> = {}): ContextJwtUser {
  return {
    id: USER_ID_SCHOOL_ADMIN,
    email: 'schooladmin@nbk.edu.vn',
    role: UserRole.SCHOOL_ADMIN,
    schoolId: SCHOOL_A_ID,
    accessibleSchoolIds: [SCHOOL_A_ID],
    companySchoolId: null,
    ...overrides,
  };
}

// ─── Mock Schools Database ──────────────────────────────────────────────────

const schoolsDb: SchoolEntity[] = [
  createMockSchool({
    id: COMPANY_ID,
    code: 'HOLDING',
    name: 'Hệ thống NBK',
    parentSchoolId: null,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: SCHOOL_A_ID,
    code: 'TH01',
    name: 'Trường Tiểu học NBK',
    parentSchoolId: COMPANY_ID,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: SCHOOL_B_ID,
    code: 'THCS01',
    name: 'Trường THCS NBK',
    parentSchoolId: COMPANY_ID,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: SCHOOL_C_ID,
    code: 'THPT01',
    name: 'Trường THPT NBK',
    parentSchoolId: COMPANY_ID,
    status: SchoolStatus.INACTIVE,
  }),
];

// ─── Integration Test Suite ─────────────────────────────────────────────────

/**
 * Integration Tests: Context Switcher Full Flow
 *
 * Tests the complete context switching flow through Controller → Service → SessionService
 * with mocked Redis (CacheService) and mocked externals.
 * Tests TenantMiddleware integration with ContextSessionService.
 *
 * Requirements validated: 2.9, 3.1–3.8, 5.1–5.6, 9.1–9.10, 12.1–12.7
 */
describe('Context Switcher — Integration Tests', () => {
  let module: TestingModule;
  let contextService: ContextService;
  let contextSessionService: ContextSessionService;
  let tenantMiddleware: TenantMiddleware;
  let cacheService: CacheService;
  let mockSchoolRepository: jest.Mocked<SchoolRepository>;
  let mockSchoolEntityRepo: Partial<Repository<SchoolEntity>>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;
  let mockTeacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;
  let tenantContextService: TenantContextService;
  let tenantAuditService: jest.Mocked<TenantAuditService>;
  let tenantRlsService: jest.Mocked<TenantRlsService>;

  beforeAll(async () => {
    // Use real CacheService (in-memory Map) as "mocked Redis"
    cacheService = new CacheService();

    mockSchoolRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<SchoolRepository>;

    mockSchoolEntityRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    mockTeacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
      createAssignment: jest.fn(),
      deactivateAssignment: jest.fn(),
      validateTeacherSchoolAccess: jest.fn(),
      validateSameOrganization: jest.fn(),
      countSecondaryAssignments: jest.fn(),
      findByTeacher: jest.fn(),
      findBySchool: jest.fn(),
    } as unknown as jest.Mocked<TeacherSchoolAssignmentService>;

    tenantContextService = new TenantContextService();
    tenantAuditService = {
      logImpersonation: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;
    tenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TenantRlsService>;

    // Configure mock school repository behavior
    mockSchoolRepository.findById.mockImplementation(async (id: string) => {
      return schoolsDb.find((s) => s.id === id) || null;
    });

    (mockSchoolEntityRepo.findOne as jest.Mock).mockImplementation(
      async (opts: { where: { id: string }; select?: string[] }) => {
        return schoolsDb.find((s) => s.id === opts.where.id) || null;
      },
    );

    (mockSchoolEntityRepo.find as jest.Mock).mockImplementation(
      async (opts?: { where?: Record<string, unknown> }) => {
        if (!opts?.where) return schoolsDb.filter((s) => s.status === SchoolStatus.ACTIVE);
        const where = opts.where;
        return schoolsDb.filter((s) => {
          let match = true;
          // Handle TypeORM In() operator for id field
          if (where.id && typeof where.id === 'object' && '_value' in (where.id as object)) {
            const inValues = (where.id as { _value: string[] })._value;
            match = match && inValues.includes(s.id);
          } else if (where.id && typeof where.id === 'string') {
            match = match && s.id === where.id;
          }
          if (where.status && typeof where.status === 'string') {
            match = match && s.status === where.status;
          }
          if (where.parentSchoolId && typeof where.parentSchoolId === 'string') {
            match = match && s.parentSchoolId === where.parentSchoolId;
          }
          // Handle deletedAt IsNull() - just filter out deleted
          if ('deletedAt' in where) {
            match = match && s.deletedAt === null;
          }
          return match;
        });
      },
    );

    // Mock createQueryBuilder for filterActiveSchoolIds in ContextService
    const createMockQueryBuilder = () => {
      let capturedIds: string[] = [];
      let capturedParentIds: string[] = [];
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation((_condition: string, params?: { ids?: string[] }) => {
          if (params?.ids) {
            if (_condition.includes('parentSchoolId')) {
              capturedParentIds = params.ids;
            } else {
              capturedIds = params.ids;
            }
          }
          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockImplementation(async () => {
          return schoolsDb.filter(
            (s) => capturedIds.includes(s.id) && s.status === SchoolStatus.ACTIVE && !s.deletedAt,
          );
        }),
        getRawMany: jest.fn().mockImplementation(async () => {
          // For findSchoolIdsWithChildren: find schools that have children among the given IDs
          const parentIds = schoolsDb
            .filter((s) => capturedParentIds.includes(s.parentSchoolId!) && !s.deletedAt)
            .map((s) => s.parentSchoolId)
            .filter((id, idx, arr) => arr.indexOf(id) === idx);
          return parentIds.map((id) => ({ parentSchoolId: id }));
        }),
      };
      return qb;
    };
    (mockSchoolEntityRepo.createQueryBuilder as jest.Mock).mockImplementation(() => createMockQueryBuilder());

    module = await Test.createTestingModule({
      providers: [
        ContextService,
        ContextSessionService,
        {
          provide: SchoolRepository,
          useValue: mockSchoolRepository,
        },
        {
          provide: getRepositoryToken(SchoolEntity),
          useValue: mockSchoolEntityRepo,
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: TeacherSchoolAssignmentService,
          useValue: mockTeacherSchoolAssignmentService,
        },
        {
          provide: TenantContextService,
          useValue: tenantContextService,
        },
        {
          provide: TenantAuditService,
          useValue: tenantAuditService,
        },
        {
          provide: TenantRlsService,
          useValue: tenantRlsService,
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    contextService = module.get(ContextService);
    contextSessionService = module.get(ContextSessionService);

    // Create TenantMiddleware manually with all dependencies
    tenantMiddleware = new TenantMiddleware(
      tenantContextService,
      tenantAuditService,
      tenantRlsService,
      mockSchoolEntityRepo as Repository<SchoolEntity>,
      contextSessionService,
      contextService,
    );
  });

  beforeEach(async () => {
    // Clear all cached sessions between tests
    await cacheService.flush();
    jest.clearAllMocks();

    // Re-configure mocks for clean state
    mockSchoolRepository.findById.mockImplementation(async (id: string) => {
      return schoolsDb.find((s) => s.id === id) || null;
    });

    (mockSchoolEntityRepo.findOne as jest.Mock).mockImplementation(
      async (opts: { where: { id: string }; select?: string[] }) => {
        return schoolsDb.find((s) => s.id === opts.where.id) || null;
      },
    );

    (mockSchoolEntityRepo.find as jest.Mock).mockImplementation(
      async (opts?: { where?: Record<string, unknown> }) => {
        if (!opts?.where) return schoolsDb.filter((s) => s.status === SchoolStatus.ACTIVE);
        const where = opts.where;
        return schoolsDb.filter((s) => {
          let match = true;
          if (where.id && typeof where.id === 'object' && '_value' in (where.id as object)) {
            const inValues = (where.id as { _value: string[] })._value;
            match = match && inValues.includes(s.id);
          } else if (where.id && typeof where.id === 'string') {
            match = match && s.id === where.id;
          }
          if (where.status && typeof where.status === 'string') {
            match = match && s.status === where.status;
          }
          if (where.parentSchoolId && typeof where.parentSchoolId === 'string') {
            match = match && s.parentSchoolId === where.parentSchoolId;
          }
          if ('deletedAt' in where) {
            match = match && s.deletedAt === null;
          }
          return match;
        });
      },
    );

    // Re-configure createQueryBuilder mock
    const createMockQueryBuilder = () => {
      let capturedIds: string[] = [];
      let capturedParentIds: string[] = [];
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation((_condition: string, params?: { ids?: string[] }) => {
          if (params?.ids) {
            if (_condition.includes('parentSchoolId')) {
              capturedParentIds = params.ids;
            } else {
              capturedIds = params.ids;
            }
          }
          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockImplementation(async () => {
          return schoolsDb.filter(
            (s) => capturedIds.includes(s.id) && s.status === SchoolStatus.ACTIVE && !s.deletedAt,
          );
        }),
        getRawMany: jest.fn().mockImplementation(async () => {
          const parentIds = schoolsDb
            .filter((s) => capturedParentIds.includes(s.parentSchoolId!) && !s.deletedAt)
            .map((s) => s.parentSchoolId)
            .filter((id, idx, arr) => arr.indexOf(id) === idx);
          return parentIds.map((id) => ({ parentSchoolId: id }));
        }),
      };
      return qb;
    };
    (mockSchoolEntityRepo.createQueryBuilder as jest.Mock).mockImplementation(() => createMockQueryBuilder());
  });

  afterAll(async () => {
    await module.close();
  });

  // ─── Test Suite 1: Full Context Switch Flow ─────────────────────────────────

  describe('Full context switch flow: get accessible schools → switch → verify session', () => {
    it('should return accessible schools for a multi-school TEACHER', async () => {
      const user = createTeacherUser();
      const result = await contextService.getAccessibleSchools(user);

      expect(result.canSwitch).toBe(true);
      expect(result.schools.length).toBeGreaterThanOrEqual(1);
      // Only ACTIVE schools should be returned
      result.schools.forEach((school) => {
        expect([SCHOOL_A_ID, SCHOOL_B_ID]).toContain(school.id);
      });
    });

    it('should switch context and store session in Redis (CacheService)', async () => {
      const user = createTeacherUser();

      // Switch context to School B
      const result = await contextService.switchContext(user, SCHOOL_B_ID, '127.0.0.1');

      expect(result.id).toBe(SCHOOL_B_ID);
      expect(result.code).toBe('THCS01');
      expect(result.name).toBe('Trường THCS NBK');

      // Verify session is stored in cache (Redis mock)
      const storedContext = await contextSessionService.getActiveContext(user.id);
      expect(storedContext).toBe(SCHOOL_B_ID);
    });

    it('should resolve subsequent requests to switched school via TenantMiddleware', async () => {
      const user = createTeacherUser();

      // First: switch context
      await contextService.switchContext(user, SCHOOL_B_ID, '127.0.0.1');

      // Second: simulate a request without X-School-Id header
      const req = {
        headers: {},
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          accessibleSchoolIds: user.accessibleSchoolIds,
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;

      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      expect(resolvedStore!.schoolId).toBe(SCHOOL_B_ID);
      expect(resolvedStore!.isBypass).toBe(false);
    });

    it('should log audit entry on successful context switch', async () => {
      const user = createTeacherUser();

      await contextService.switchContext(user, SCHOOL_B_ID, '192.168.1.1');

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          schoolId: SCHOOL_B_ID,
          action: 'CONTEXT_SWITCH',
          entityType: 'context_session',
          entityId: user.id,
          ipAddress: '192.168.1.1',
        }),
      );
    });
  });

  // ─── Test Suite 2: Multi-tenant Isolation ───────────────────────────────────

  describe('Multi-tenant isolation: user of school A cannot switch to school B', () => {
    it('should reject switch to inaccessible school with 403', async () => {
      // SCHOOL_ADMIN only has access to SCHOOL_A
      const user = createSchoolAdminUser();

      await expect(
        contextService.switchContext(user, SCHOOL_B_ID, '127.0.0.1'),
      ).rejects.toThrow(ContextForbiddenException);
    });

    it('should not reveal whether school exists when user has no access', async () => {
      const user = createSchoolAdminUser();
      const NON_EXISTENT_SCHOOL = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

      // Both non-existent and existent-but-inaccessible return same 403
      await expect(
        contextService.switchContext(user, NON_EXISTENT_SCHOOL, '127.0.0.1'),
      ).rejects.toThrow(ContextForbiddenException);

      await expect(
        contextService.switchContext(user, SCHOOL_B_ID, '127.0.0.1'),
      ).rejects.toThrow(ContextForbiddenException);
    });

    it('should reject X-School-Id header for inaccessible school in middleware', async () => {
      const req = {
        headers: { 'x-school-id': SCHOOL_C_ID },
        method: 'GET',
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID], // Has 2 schools, multi-school user
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;
      const next = jest.fn();

      await expect(
        tenantMiddleware.use(req, res, next),
      ).rejects.toThrow(ContextForbiddenException);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow teacher to switch only to accessible schools', async () => {
      const user = createTeacherUser({ accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID] });

      // Can switch to School A (accessible)
      const resultA = await contextService.switchContext(user, SCHOOL_A_ID, '127.0.0.1');
      expect(resultA.id).toBe(SCHOOL_A_ID);

      // Can switch to School B (accessible)
      const resultB = await contextService.switchContext(user, SCHOOL_B_ID, '127.0.0.1');
      expect(resultB.id).toBe(SCHOOL_B_ID);

      // Cannot switch to School C (inactive)
      await expect(
        contextService.switchContext(user, SCHOOL_C_ID, '127.0.0.1'),
      ).rejects.toThrow();
    });
  });

  // ─── Test Suite 3: Global View Mode ─────────────────────────────────────────

  describe('Global View mode: SUPER_ADMIN GET succeeds, POST rejected with 403', () => {
    it('should activate Global View for SUPER_ADMIN with X-School-Id: "global"', async () => {
      const req = {
        headers: { 'x-school-id': 'global' },
        method: 'GET',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      expect(resolvedStore!.globalView).toBe(true);
      expect(resolvedStore!.isBypass).toBe(true);
      expect(resolvedStore!.schoolId).toBeNull();
    });

    it('should reject POST request in Global View mode with 403', async () => {
      const req = {
        headers: { 'x-school-id': 'global' },
        method: 'POST',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;
      const next = jest.fn();

      await expect(
        tenantMiddleware.use(req, res, next),
      ).rejects.toThrow(GlobalViewReadonlyException);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject PATCH request in Global View mode with 403', async () => {
      const req = {
        headers: { 'x-school-id': 'global' },
        method: 'PATCH',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;
      const next = jest.fn();

      await expect(
        tenantMiddleware.use(req, res, next),
      ).rejects.toThrow(GlobalViewReadonlyException);
    });

    it('should reject DELETE request in Global View mode with 403', async () => {
      const req = {
        headers: { 'x-school-id': 'global' },
        method: 'DELETE',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;
      const next = jest.fn();

      await expect(
        tenantMiddleware.use(req, res, next),
      ).rejects.toThrow(GlobalViewReadonlyException);
    });

    it('should reject Global View for non-SUPER_ADMIN with 403', async () => {
      const req = {
        headers: { 'x-school-id': 'global' },
        method: 'GET',
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;
      const next = jest.fn();

      await expect(
        tenantMiddleware.use(req, res, next),
      ).rejects.toThrow(GlobalViewForbiddenException);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ─── Test Suite 4: Backward Compatibility ───────────────────────────────────

  describe('Backward compatibility: existing X-School-Id impersonation', () => {
    it('should allow SUPER_ADMIN to impersonate via X-School-Id header (valid UUID)', async () => {
      const req = {
        headers: { 'x-school-id': SCHOOL_A_ID },
        method: 'GET',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
      expect(resolvedStore!.isBypass).toBe(false);
      expect(resolvedStore!.globalView).toBeFalsy();
    });

    it('should fallback to bypass mode for SUPER_ADMIN without header or session', async () => {
      const req = {
        headers: {},
        method: 'GET',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      expect(resolvedStore!.schoolId).toBeNull();
      expect(resolvedStore!.isBypass).toBe(true);
    });

    it('should resolve single-school user from JWT regardless of X-School-Id header', async () => {
      const req = {
        headers: { 'x-school-id': SCHOOL_B_ID },
        method: 'GET',
        user: {
          id: USER_ID_SCHOOL_ADMIN,
          email: 'schooladmin@nbk.edu.vn',
          role: UserRole.SCHOOL_ADMIN,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      // Single-school users ignore X-School-Id header (Requirement 9.10)
      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
      expect(resolvedStore!.isBypass).toBe(false);
    });

    it('should reject invalid UUID in X-School-Id header with 400', async () => {
      const req = {
        headers: { 'x-school-id': 'not-a-uuid' },
        method: 'GET',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;
      const next = jest.fn();

      await expect(
        tenantMiddleware.use(req, res, next),
      ).rejects.toThrow(BadRequestException);
      expect(next).not.toHaveBeenCalled();
    });

    it('should set schoolScope on request for backward compat with SchoolScopeGuard', async () => {
      const req = {
        headers: { 'x-school-id': SCHOOL_A_ID },
        method: 'GET',
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      } as unknown as import('express').Request & { schoolScope?: string | null };
      const res = {} as import('express').Response;
      const next = jest.fn();

      await tenantMiddleware.use(req, res, next);

      expect((req as any).schoolScope).toBe(SCHOOL_A_ID);
    });
  });

  // ─── Test Suite 5: Context Expiration and Fallback ──────────────────────────

  describe('Context expiration: when session is missing/expired, falls back to JWT', () => {
    it('should fall back to JWT schoolId when no session exists', async () => {
      const req = {
        headers: {},
        method: 'GET',
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Falls back to JWT schoolId
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
    });

    it('should invalidate stale session and fall back to JWT', async () => {
      const userId = USER_ID_TEACHER;

      // Manually set a session pointing to a school no longer accessible
      await contextSessionService.setActiveContext(userId, SCHOOL_C_ID);

      const req = {
        headers: {},
        method: 'GET',
        user: {
          id: userId,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID], // C not accessible
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Should fall back to JWT because session school is not accessible
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);

      // Stale session should have been deleted
      const sessionAfter = await contextSessionService.getActiveContext(userId);
      expect(sessionAfter).toBeNull();
    });

    it('should fall back to JWT when Redis (CacheService) is unavailable', async () => {
      // Simulate cache failure by making get throw
      const originalGet = cacheService.get.bind(cacheService);
      jest.spyOn(cacheService, 'get').mockRejectedValue(new Error('Redis connection lost'));

      const req = {
        headers: {},
        method: 'GET',
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Falls back to JWT schoolId silently (Requirement 9.6)
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);

      // Restore
      jest.spyOn(cacheService, 'get').mockImplementation(originalGet);
    });

    it('should use session when it is valid and school is accessible', async () => {
      const userId = USER_ID_TEACHER;

      // Set a valid session
      await contextSessionService.setActiveContext(userId, SCHOOL_B_ID);

      const req = {
        headers: {},
        method: 'GET',
        user: {
          id: userId,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      } as unknown as import('express').Request;
      const res = {} as import('express').Response;

      let resolvedStore: import('../../../src/common/tenant/tenant.interfaces').TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Should use session value since school B is accessible
      expect(resolvedStore!.schoolId).toBe(SCHOOL_B_ID);
    });
  });

  // ─── Test Suite 6: Redis Session CRUD ──────────────────────────────────────

  describe('Session CRUD: set, get, refresh TTL, delete operations', () => {
    it('should store and retrieve a context session', async () => {
      const userId = 'crud-test-user-001';

      await contextSessionService.setActiveContext(userId, SCHOOL_A_ID);

      const result = await contextSessionService.getActiveContext(userId);
      expect(result).toBe(SCHOOL_A_ID);
    });

    it('should return null for non-existent session', async () => {
      const result = await contextSessionService.getActiveContext('non-existent-user');
      expect(result).toBeNull();
    });

    it('should delete a session', async () => {
      const userId = 'crud-test-user-002';

      await contextSessionService.setActiveContext(userId, SCHOOL_B_ID);
      expect(await contextSessionService.getActiveContext(userId)).toBe(SCHOOL_B_ID);

      await contextSessionService.deleteSession(userId);
      expect(await contextSessionService.getActiveContext(userId)).toBeNull();
    });

    it('should overwrite previous session on re-switch', async () => {
      const userId = 'crud-test-user-003';

      await contextSessionService.setActiveContext(userId, SCHOOL_A_ID);
      expect(await contextSessionService.getActiveContext(userId)).toBe(SCHOOL_A_ID);

      // Switch again to School B
      await contextSessionService.setActiveContext(userId, SCHOOL_B_ID);
      expect(await contextSessionService.getActiveContext(userId)).toBe(SCHOOL_B_ID);
    });

    it('should refresh TTL without changing stored value', async () => {
      const userId = 'crud-test-user-004';

      await contextSessionService.setActiveContext(userId, SCHOOL_A_ID);
      const before = await contextSessionService.getActiveContext(userId);

      // Refresh TTL
      await contextSessionService.refreshTtl(userId);

      const after = await contextSessionService.getActiveContext(userId);
      expect(after).toBe(before);
      expect(after).toBe(SCHOOL_A_ID);
    });

    it('should handle refreshTtl gracefully for non-existent session', async () => {
      // Should not throw
      await expect(
        contextSessionService.refreshTtl('non-existent-user-refresh'),
      ).resolves.toBeUndefined();
    });

    it('should handle deleteSession gracefully for non-existent key', async () => {
      // Should not throw
      await expect(
        contextSessionService.deleteSession('non-existent-user-delete'),
      ).resolves.toBeUndefined();
    });

    it('should isolate sessions between different users', async () => {
      const userA = 'session-isolation-user-A';
      const userB = 'session-isolation-user-B';

      await contextSessionService.setActiveContext(userA, SCHOOL_A_ID);
      await contextSessionService.setActiveContext(userB, SCHOOL_B_ID);

      expect(await contextSessionService.getActiveContext(userA)).toBe(SCHOOL_A_ID);
      expect(await contextSessionService.getActiveContext(userB)).toBe(SCHOOL_B_ID);

      // Deleting user A does not affect user B
      await contextSessionService.deleteSession(userA);
      expect(await contextSessionService.getActiveContext(userA)).toBeNull();
      expect(await contextSessionService.getActiveContext(userB)).toBe(SCHOOL_B_ID);
    });
  });
});
