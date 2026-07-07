import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
}));

import { ContextService, ContextJwtUser } from '../../../src/modules/context/services/context.service';
import { ContextSessionService } from '../../../src/modules/context/services/context-session.service';
import { ContextFeatureFlagService } from '../../../src/modules/context/services/context-feature-flag.service';
import { TenantMiddleware } from '../../../src/common/tenant/tenant.middleware';
import { TenantContextService } from '../../../src/common/tenant/tenant-context.service';
import { TenantAuditService } from '../../../src/common/tenant/tenant-audit.service';
import { TenantRlsService } from '../../../src/common/tenant/tenant-rls.service';
import { TenantStore } from '../../../src/common/tenant/tenant.interfaces';
import { SchoolEntity } from '../../../src/modules/school/entities/school.entity';
import { SchoolRepository } from '../../../src/modules/school/school.repository';
import { CacheService } from '../../../src/modules/cache/cache.service';
import { AuditLogService } from '../../../src/modules/audit/services/audit-log.service';
import { TeacherSchoolAssignmentService } from '../../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { UserRole } from '../../../src/common/enums/role.enum';
import { SchoolStatus } from '../../../src/common/enums/status.enum';

// ─── Test Constants ─────────────────────────────────────────────────────────

const SCHOOL_A_ID = 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa';
const SCHOOL_B_ID = 'bbbbbbbb-2222-4bbb-bbbb-bbbbbbbbbbbb';
const SCHOOL_C_ID = 'cccccccc-3333-4ccc-cccc-cccccccccccc';
const COMPANY_ID = 'dddddddd-4444-4ddd-dddd-dddddddddddd';
const USER_ID_TEACHER = 'user-teacher-ff-0001';
const USER_ID_SUPER = 'user-super-ff-0001';
const USER_ID_COMPANY_ADMIN = 'user-company-ff-0001';

// ─── Test Data Factories ────────────────────────────────────────────────────

function createMockSchool(overrides: Partial<SchoolEntity> = {}): SchoolEntity {
  return {
    id: SCHOOL_A_ID,
    code: 'TH01',
    name: 'Trường Tiểu học NBK',
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
    status: SchoolStatus.ACTIVE,
  }),
];

// ─── Mock ConfigService with mutable env ────────────────────────────────────

/**
 * A mutable env store that allows changing feature flag values
 * between test cases — simulates env var changes without restart.
 */
const envStore: Record<string, string> = {
  CONTEXT_SWITCHER_ENABLED: 'true',
  CONTEXT_SWITCHER_DISABLED_SCHOOLS: '',
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    return envStore[key] ?? defaultValue;
  }),
};

// ─── Integration Test Suite ─────────────────────────────────────────────────

/**
 * Integration Tests: Feature Flag Behavior
 *
 * Tests that the context switcher feature flag correctly controls
 * whether TenantMiddleware uses Redis session resolution or JWT-only.
 *
 * Requirements validated: 18.1, 18.3
 */
describe('Context Feature Flag — Integration Tests', () => {
  let module: TestingModule;
  let contextService: ContextService;
  let contextSessionService: ContextSessionService;
  let featureFlagService: ContextFeatureFlagService;
  let tenantMiddleware: TenantMiddleware;
  let cacheService: CacheService;
  let tenantContextService: TenantContextService;
  let tenantAuditService: jest.Mocked<TenantAuditService>;
  let tenantRlsService: jest.Mocked<TenantRlsService>;
  let mockSchoolRepository: jest.Mocked<SchoolRepository>;
  let mockSchoolEntityRepo: Partial<Repository<SchoolEntity>>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;
  let mockTeacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;

  beforeAll(async () => {
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

    // Configure mock repositories
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

    // Mock createQueryBuilder for ContextService internals
    const createMockQueryBuilder = () => {
      let capturedIds: string[] = [];
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation((_condition: string, params?: { ids?: string[] }) => {
          if (params?.ids) capturedIds = params.ids;
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
            .filter((s) => capturedIds.includes(s.parentSchoolId!) && !s.deletedAt)
            .map((s) => s.parentSchoolId)
            .filter((id, idx, arr) => arr.indexOf(id) === idx);
          return parentIds.map((id) => ({ parentSchoolId: id }));
        }),
      };
      return qb;
    };
    (mockSchoolEntityRepo.createQueryBuilder as jest.Mock).mockImplementation(
      () => createMockQueryBuilder(),
    );

    module = await Test.createTestingModule({
      providers: [
        ContextService,
        ContextSessionService,
        ContextFeatureFlagService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SchoolRepository, useValue: mockSchoolRepository },
        { provide: getRepositoryToken(SchoolEntity), useValue: mockSchoolEntityRepo },
        { provide: CacheService, useValue: cacheService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: TeacherSchoolAssignmentService, useValue: mockTeacherSchoolAssignmentService },
        { provide: TenantContextService, useValue: tenantContextService },
        { provide: TenantAuditService, useValue: tenantAuditService },
        { provide: TenantRlsService, useValue: tenantRlsService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    contextService = module.get(ContextService);
    contextSessionService = module.get(ContextSessionService);
    featureFlagService = module.get(ContextFeatureFlagService);

    // Create TenantMiddleware manually with all dependencies including feature flag
    tenantMiddleware = new TenantMiddleware(
      tenantContextService,
      tenantAuditService,
      tenantRlsService,
      mockSchoolEntityRepo as Repository<SchoolEntity>,
      contextSessionService,
      contextService,
      featureFlagService,
    );
  });

  beforeEach(async () => {
    await cacheService.flush();
    jest.clearAllMocks();

    // Reset env to default (enabled)
    envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';
    envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = '';
  });

  afterAll(async () => {
    await module.close();
  });

  // ─── Helper ─────────────────────────────────────────────────────────────────

  function createRequest(overrides: Record<string, unknown> = {}) {
    return {
      headers: {},
      method: 'GET',
      ...overrides,
    } as unknown as import('express').Request;
  }

  // ─── Suite 1: Feature Disabled — JWT-Only Resolution ────────────────────────

  describe('Feature disabled (CONTEXT_SWITCHER_ENABLED=false): JWT-only resolution', () => {
    beforeEach(() => {
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'false';
    });

    it('should skip Redis session and resolve from JWT schoolId for TEACHER', async () => {
      // Pre-populate a session that should be IGNORED
      await contextSessionService.setActiveContext(USER_ID_TEACHER, SCHOOL_B_ID);

      const req = createRequest({
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Feature disabled → falls back to JWT (TEACHER = non-SUPER_ADMIN → JWT schoolId)
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
      expect(resolvedStore!.isBypass).toBe(false);
    });

    it('should skip Redis session for SUPER_ADMIN and fall back to bypass mode', async () => {
      // Pre-populate a session that should be IGNORED when feature is disabled
      await contextSessionService.setActiveContext(USER_ID_SUPER, SCHOOL_A_ID);

      const req = createRequest({
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Feature disabled, no header → SUPER_ADMIN falls back to bypass mode
      expect(resolvedStore!.schoolId).toBeNull();
      expect(resolvedStore!.isBypass).toBe(true);
    });

    it('should still allow SUPER_ADMIN impersonation via X-School-Id header (backward compat)', async () => {
      const req = createRequest({
        headers: { 'x-school-id': SCHOOL_A_ID },
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // SUPER_ADMIN impersonation works even when feature is disabled
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
      expect(resolvedStore!.isBypass).toBe(false);
    });

    it('should ignore X-School-Id header for non-SUPER_ADMIN when feature disabled', async () => {
      const req = createRequest({
        headers: { 'x-school-id': SCHOOL_B_ID },
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Feature disabled → non-SUPER_ADMIN: JWT fallback regardless of header
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
    });

    it('should ignore Global View header when feature is disabled', async () => {
      const req = createRequest({
        headers: { 'x-school-id': 'global' },
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Feature disabled → Global View is NOT activated, falls back to bypass
      expect(resolvedStore!.globalView).toBeFalsy();
      expect(resolvedStore!.isBypass).toBe(true);
      expect(resolvedStore!.schoolId).toBeNull();
    });
  });

  // ─── Suite 2: Feature Enabled — Full Context Session Flow ───────────────────

  describe('Feature enabled (CONTEXT_SWITCHER_ENABLED=true): full context flow works', () => {
    beforeEach(() => {
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';
    });

    it('should resolve from Redis session when feature is enabled and session exists', async () => {
      // Store a session for the multi-school teacher
      await contextSessionService.setActiveContext(USER_ID_TEACHER, SCHOOL_B_ID);

      const req = createRequest({
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Feature enabled → session is used (Priority 2: Redis session)
      expect(resolvedStore!.schoolId).toBe(SCHOOL_B_ID);
      expect(resolvedStore!.isBypass).toBe(false);
    });

    it('should respect X-School-Id header priority over session when feature enabled', async () => {
      // Store a session pointing to School B
      await contextSessionService.setActiveContext(USER_ID_TEACHER, SCHOOL_B_ID);

      // But send header pointing to School A (higher priority)
      const req = createRequest({
        headers: { 'x-school-id': SCHOOL_A_ID },
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // Header takes priority over session
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
    });

    it('should activate Global View mode for SUPER_ADMIN when feature enabled', async () => {
      const req = createRequest({
        headers: { 'x-school-id': 'global' },
        user: {
          id: USER_ID_SUPER,
          email: 'admin@nbk.edu.vn',
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          accessibleSchoolIds: [],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      expect(resolvedStore!.globalView).toBe(true);
      expect(resolvedStore!.isBypass).toBe(true);
    });

    it('should fall back to JWT when no session exists and feature enabled', async () => {
      // No session stored — should fallback to JWT
      const req = createRequest({
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await tenantMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // No session, no header → JWT fallback
      expect(resolvedStore!.schoolId).toBe(SCHOOL_A_ID);
    });
  });

  // ─── Suite 3: Per-School Disable List ───────────────────────────────────────

  describe('Per-school disable: CONTEXT_SWITCHER_DISABLED_SCHOOLS', () => {
    it('should return false from isEnabledForSchool when school is in disabled list', () => {
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';
      envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = SCHOOL_A_ID;

      expect(featureFlagService.isEnabledForSchool(SCHOOL_A_ID)).toBe(false);
      expect(featureFlagService.isEnabledForSchool(SCHOOL_B_ID)).toBe(true);
    });

    it('should handle multiple schools in disabled list', () => {
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';
      envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = `${SCHOOL_A_ID},${SCHOOL_B_ID}`;

      expect(featureFlagService.isEnabledForSchool(SCHOOL_A_ID)).toBe(false);
      expect(featureFlagService.isEnabledForSchool(SCHOOL_B_ID)).toBe(false);
      expect(featureFlagService.isEnabledForSchool(SCHOOL_C_ID)).toBe(true);
    });

    it('should return false for all schools when global flag is disabled', () => {
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'false';
      envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = '';

      // Even if school is not in disabled list, global flag overrides
      expect(featureFlagService.isEnabledForSchool(SCHOOL_A_ID)).toBe(false);
      expect(featureFlagService.isEnabledForSchool(SCHOOL_B_ID)).toBe(false);
    });

    it('should return true for all schools when global enabled and no disabled schools', () => {
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';
      envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = '';

      expect(featureFlagService.isEnabledForSchool(SCHOOL_A_ID)).toBe(true);
      expect(featureFlagService.isEnabledForSchool(SCHOOL_B_ID)).toBe(true);
      expect(featureFlagService.isEnabledForSchool(SCHOOL_C_ID)).toBe(true);
    });
  });

  // ─── Suite 4: Dynamic Flag Change Without Restart ───────────────────────────

  describe('Feature flag change does not require restart (dynamic env reads)', () => {
    it('should switch from disabled to enabled without restart', async () => {
      // Start with feature disabled
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'false';

      // Store a session
      await contextSessionService.setActiveContext(USER_ID_TEACHER, SCHOOL_B_ID);

      const userPayload = {
        id: USER_ID_TEACHER,
        email: 'teacher@nbk.edu.vn',
        role: UserRole.TEACHER,
        schoolId: SCHOOL_A_ID,
        accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
      };

      // Request 1: feature disabled → JWT fallback (ignores session)
      const req1 = createRequest({ user: userPayload });
      const res = {} as import('express').Response;
      let store1: TenantStore | undefined;
      const next1 = jest.fn(() => { store1 = tenantContextService.getStore(); });

      await tenantMiddleware.use(req1, res, next1);
      expect(store1!.schoolId).toBe(SCHOOL_A_ID); // JWT fallback

      // Simulate env change: enable the feature (no restart)
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';

      // Request 2: feature now enabled → session is used
      const req2 = createRequest({ user: userPayload });
      let store2: TenantStore | undefined;
      const next2 = jest.fn(() => { store2 = tenantContextService.getStore(); });

      await tenantMiddleware.use(req2, res, next2);
      expect(store2!.schoolId).toBe(SCHOOL_B_ID); // Session used
    });

    it('should switch from enabled to disabled without restart', async () => {
      // Start with feature enabled
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';

      // Store a session
      await contextSessionService.setActiveContext(USER_ID_TEACHER, SCHOOL_B_ID);

      const userPayload = {
        id: USER_ID_TEACHER,
        email: 'teacher@nbk.edu.vn',
        role: UserRole.TEACHER,
        schoolId: SCHOOL_A_ID,
        accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
      };

      // Request 1: feature enabled → session is used
      const req1 = createRequest({ user: userPayload });
      const res = {} as import('express').Response;
      let store1: TenantStore | undefined;
      const next1 = jest.fn(() => { store1 = tenantContextService.getStore(); });

      await tenantMiddleware.use(req1, res, next1);
      expect(store1!.schoolId).toBe(SCHOOL_B_ID); // Session used

      // Simulate env change: disable the feature (no restart)
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'false';

      // Request 2: feature now disabled → JWT fallback (session ignored)
      const req2 = createRequest({ user: userPayload });
      let store2: TenantStore | undefined;
      const next2 = jest.fn(() => { store2 = tenantContextService.getStore(); });

      await tenantMiddleware.use(req2, res, next2);
      expect(store2!.schoolId).toBe(SCHOOL_A_ID); // JWT fallback
    });

    it('should dynamically respect per-school disable list changes', () => {
      envStore['CONTEXT_SWITCHER_ENABLED'] = 'true';
      envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = '';

      // Initially all enabled
      expect(featureFlagService.isEnabledForSchool(SCHOOL_A_ID)).toBe(true);

      // Add School A to disabled list (no restart)
      envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = SCHOOL_A_ID;
      expect(featureFlagService.isEnabledForSchool(SCHOOL_A_ID)).toBe(false);
      expect(featureFlagService.isEnabledForSchool(SCHOOL_B_ID)).toBe(true);

      // Remove School A from disabled list (no restart)
      envStore['CONTEXT_SWITCHER_DISABLED_SCHOOLS'] = '';
      expect(featureFlagService.isEnabledForSchool(SCHOOL_A_ID)).toBe(true);
    });
  });

  // ─── Suite 5: Feature Flag Service Availability ─────────────────────────────

  describe('Feature flag service unavailable: graceful fallback', () => {
    it('should default to enabled when feature flag service is not injected', async () => {
      // Create TenantMiddleware WITHOUT featureFlagService (simulates module unavailable)
      const middlewareNoFlag = new TenantMiddleware(
        tenantContextService,
        tenantAuditService,
        tenantRlsService,
        mockSchoolEntityRepo as Repository<SchoolEntity>,
        contextSessionService,
        contextService,
        // No featureFlagService passed → @Optional() means undefined
      );

      // Store a session
      await contextSessionService.setActiveContext(USER_ID_TEACHER, SCHOOL_B_ID);

      const req = createRequest({
        user: {
          id: USER_ID_TEACHER,
          email: 'teacher@nbk.edu.vn',
          role: UserRole.TEACHER,
          schoolId: SCHOOL_A_ID,
          accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
        },
      });
      const res = {} as import('express').Response;

      let resolvedStore: TenantStore | undefined;
      const next = jest.fn(() => {
        resolvedStore = tenantContextService.getStore();
      });

      await middlewareNoFlag.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(resolvedStore).toBeDefined();
      // No feature flag service → defaults to enabled → session is used
      expect(resolvedStore!.schoolId).toBe(SCHOOL_B_ID);
    });
  });
});
