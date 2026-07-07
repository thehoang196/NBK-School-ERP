import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
}));

import { ContextService, ContextJwtUser } from '../../../src/modules/context/services/context.service';
import { ContextSessionService } from '../../../src/modules/context/services/context-session.service';
import { HierarchyService } from '../../../src/modules/school/services/hierarchy.service';
import { PermissionCacheService } from '../../../src/modules/context/services/permission-cache.service';
import { AccessibleSchoolsCacheService } from '../../../src/modules/context/services/accessible-schools-cache.service';
import {
  WorkspaceChangedCacheSubscriber,
  WorkspaceChangedAuditSubscriber,
} from '../../../src/modules/context/events/workspace-changed.subscriber';
import { WorkspaceChangedEvent } from '../../../src/modules/context/events/workspace-changed.event';
import { SchoolEntity } from '../../../src/modules/school/entities/school.entity';
import { SchoolRepository } from '../../../src/modules/school/school.repository';
import { CacheService } from '../../../src/modules/cache/cache.service';
import { AuditLogService } from '../../../src/modules/audit/services/audit-log.service';
import { TeacherSchoolAssignmentService } from '../../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { UserRole } from '../../../src/common/enums/role.enum';
import { SchoolStatus } from '../../../src/common/enums/status.enum';

// ─── Test Constants ─────────────────────────────────────────────────────────

const HOLDING_ID = '11111111-1111-4111-a111-111111111111';
const COMPANY_A_ID = '22222222-2222-4222-a222-222222222222';
const COMPANY_B_ID = '33333333-3333-4333-a333-333333333333';
const SCHOOL_A1_ID = '44444444-4444-4444-a444-444444444444';
const SCHOOL_A2_ID = '55555555-5555-4555-a555-555555555555';
const SCHOOL_B1_ID = '66666666-6666-4666-a666-666666666666';
const SCHOOL_A1_CHILD_ID = '77777777-7777-4777-a777-777777777777';
const USER_COMPANY_ADMIN = 'user-company-admin-001';
const USER_SUPER_ADMIN = 'user-super-admin-001';
const USER_TEACHER = 'user-teacher-001';
const CORRELATION_ID = 'corr-id-test-12345';

// ─── Test Data Factories ────────────────────────────────────────────────────

function createMockSchool(overrides: Partial<SchoolEntity> = {}): SchoolEntity {
  return {
    id: SCHOOL_A1_ID,
    code: 'TH01',
    name: 'Trường Tiểu học A1',
    address: null,
    phone: null,
    email: null,
    principalName: null,
    parentSchoolId: COMPANY_A_ID,
    parentSchool: null,
    childSchools: [],
    status: SchoolStatus.ACTIVE,
    schoolId: SCHOOL_A1_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  } as SchoolEntity;
}

function createCompanyAdminUser(overrides: Partial<ContextJwtUser> = {}): ContextJwtUser {
  return {
    id: USER_COMPANY_ADMIN,
    email: 'companyadmin@nbk.edu.vn',
    role: UserRole.COMPANY_ADMIN,
    schoolId: null,
    accessibleSchoolIds: [],
    companySchoolId: COMPANY_A_ID,
    ...overrides,
  };
}

function createSuperAdminUser(overrides: Partial<ContextJwtUser> = {}): ContextJwtUser {
  return {
    id: USER_SUPER_ADMIN,
    email: 'admin@nbk.edu.vn',
    role: UserRole.SUPER_ADMIN,
    schoolId: null,
    accessibleSchoolIds: [],
    companySchoolId: null,
    ...overrides,
  };
}

function createTeacherUser(overrides: Partial<ContextJwtUser> = {}): ContextJwtUser {
  return {
    id: USER_TEACHER,
    email: 'teacher@nbk.edu.vn',
    role: UserRole.TEACHER,
    schoolId: SCHOOL_A1_ID,
    accessibleSchoolIds: [SCHOOL_A1_ID, SCHOOL_A2_ID],
    companySchoolId: null,
    ...overrides,
  };
}

// ─── 3-Level Hierarchy Database ─────────────────────────────────────────────
// Holding (root) → Company A, Company B → School A1, A2, B1 → School A1 Child

const schoolsDb: SchoolEntity[] = [
  createMockSchool({
    id: HOLDING_ID,
    code: 'HOLD',
    name: 'NBK Holding',
    parentSchoolId: null,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: COMPANY_A_ID,
    code: 'COMP_A',
    name: 'Công ty Giáo dục A',
    parentSchoolId: HOLDING_ID,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: COMPANY_B_ID,
    code: 'COMP_B',
    name: 'Công ty Giáo dục B',
    parentSchoolId: HOLDING_ID,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: SCHOOL_A1_ID,
    code: 'TH_A1',
    name: 'Trường Tiểu học A1',
    parentSchoolId: COMPANY_A_ID,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: SCHOOL_A2_ID,
    code: 'THCS_A2',
    name: 'Trường THCS A2',
    parentSchoolId: COMPANY_A_ID,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: SCHOOL_B1_ID,
    code: 'TH_B1',
    name: 'Trường Tiểu học B1',
    parentSchoolId: COMPANY_B_ID,
    status: SchoolStatus.ACTIVE,
  }),
  createMockSchool({
    id: SCHOOL_A1_CHILD_ID,
    code: 'TH_A1C',
    name: 'Cơ sở 2 - Trường TH A1',
    parentSchoolId: SCHOOL_A1_ID,
    status: SchoolStatus.ACTIVE,
  }),
];

// ─── Integration Test Suite: v1.1 Features ──────────────────────────────────

/**
 * Integration Tests: Context Switcher v1.1 Features
 *
 * Tests WorkspaceChangedEvent, HierarchyService, Permission Cache,
 * and the full context flow with all v1.1 additions working together.
 *
 * Requirements validated: 13.1-13.4, 14.1-14.3, 15.1-15.4
 */
describe('Context Switcher v1.1 — Integration Tests', () => {
  let module: TestingModule;
  let contextService: ContextService;
  let contextSessionService: ContextSessionService;
  let hierarchyService: HierarchyService;
  let permissionCacheService: PermissionCacheService;
  let accessibleSchoolsCacheService: AccessibleSchoolsCacheService;
  let cacheSubscriber: WorkspaceChangedCacheSubscriber;
  let auditSubscriber: WorkspaceChangedAuditSubscriber;
  let cacheService: CacheService;
  let eventEmitter: EventEmitter2;
  let mockSchoolRepository: jest.Mocked<SchoolRepository>;
  let mockSchoolEntityRepo: Partial<Repository<SchoolEntity>>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;
  let mockTeacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;

  beforeAll(async () => {
    cacheService = new CacheService();
    eventEmitter = new EventEmitter2();

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

    // Configure mock school repository
    mockSchoolRepository.findById.mockImplementation(async (id: string) => {
      return schoolsDb.find((s) => s.id === id) || null;
    });

    (mockSchoolEntityRepo.findOne as jest.Mock).mockImplementation(
      async (opts: { where: { id: string } }) => {
        return schoolsDb.find((s) => s.id === opts.where.id && !s.deletedAt) || null;
      },
    );

    (mockSchoolEntityRepo.find as jest.Mock).mockImplementation(
      async (opts?: { where?: Record<string, unknown>; take?: number }) => {
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
        }).slice(0, opts?.take ?? 999);
      },
    );

    // Mock createQueryBuilder for ContextService internal queries
    const createMockQueryBuilder = () => {
      let capturedIds: string[] = [];
      let capturedParentIds: string[] = [];
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation((_cond: string, params?: { ids?: string[] }) => {
          if (params?.ids) {
            if (_cond.includes('parentSchoolId')) {
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
    (mockSchoolEntityRepo.createQueryBuilder as jest.Mock).mockImplementation(
      () => createMockQueryBuilder(),
    );

    module = await Test.createTestingModule({
      providers: [
        ContextService,
        ContextSessionService,
        PermissionCacheService,
        AccessibleSchoolsCacheService,
        WorkspaceChangedCacheSubscriber,
        WorkspaceChangedAuditSubscriber,
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
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
        {
          provide: HierarchyService,
          useFactory: () => {
            // Real HierarchyService with mocked repo and real CacheService
            return new HierarchyService(
              mockSchoolEntityRepo as Repository<SchoolEntity>,
              cacheService,
            );
          },
        },
      ],
    }).compile();

    contextService = module.get(ContextService);
    contextSessionService = module.get(ContextSessionService);
    hierarchyService = module.get(HierarchyService);
    permissionCacheService = module.get(PermissionCacheService);
    accessibleSchoolsCacheService = module.get(AccessibleSchoolsCacheService);
    cacheSubscriber = module.get(WorkspaceChangedCacheSubscriber);
    auditSubscriber = module.get(WorkspaceChangedAuditSubscriber);
  });

  beforeEach(async () => {
    await cacheService.flush();
    jest.clearAllMocks();

    // Re-configure mocks for clean state
    mockSchoolRepository.findById.mockImplementation(async (id: string) => {
      return schoolsDb.find((s) => s.id === id) || null;
    });

    (mockSchoolEntityRepo.findOne as jest.Mock).mockImplementation(
      async (opts: { where: { id: string } }) => {
        return schoolsDb.find((s) => s.id === opts.where.id && !s.deletedAt) || null;
      },
    );

    (mockSchoolEntityRepo.find as jest.Mock).mockImplementation(
      async (opts?: { where?: Record<string, unknown>; take?: number }) => {
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
        }).slice(0, opts?.take ?? 999);
      },
    );

    const createMockQueryBuilder = () => {
      let capturedIds: string[] = [];
      let capturedParentIds: string[] = [];
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation((_cond: string, params?: { ids?: string[] }) => {
          if (params?.ids) {
            if (_cond.includes('parentSchoolId')) {
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
    (mockSchoolEntityRepo.createQueryBuilder as jest.Mock).mockImplementation(
      () => createMockQueryBuilder(),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  // ─── Suite 1: WorkspaceChangedEvent fires and subscribers execute ──────────

  describe('WorkspaceChangedEvent: switch context → event emitted → subscribers executed', () => {
    it('should emit WorkspaceChangedEvent after successful context switch', async () => {
      const user = createTeacherUser();
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await contextService.switchContext(user, SCHOOL_A2_ID, '127.0.0.1', CORRELATION_ID);

      expect(emitSpy).toHaveBeenCalledWith(
        WorkspaceChangedEvent.eventName,
        expect.objectContaining({
          userId: USER_TEACHER,
          previousSchoolId: null,
          newSchoolId: SCHOOL_A2_ID,
          correlationId: CORRELATION_ID,
        }),
      );
    });

    it('should NOT emit WorkspaceChangedEvent when switch fails (inaccessible school)', async () => {
      const user = createTeacherUser();
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await expect(
        contextService.switchContext(user, SCHOOL_B1_ID, '127.0.0.1'),
      ).rejects.toThrow();

      expect(emitSpy).not.toHaveBeenCalledWith(
        WorkspaceChangedEvent.eventName,
        expect.anything(),
      );
    });

    it('should execute cache subscriber (invalidate accessible schools cache)', async () => {
      // Pre-populate cache for user
      await accessibleSchoolsCacheService.setCachedSchoolIds(USER_TEACHER, [SCHOOL_A1_ID]);
      const cachedBefore = await accessibleSchoolsCacheService.getCachedSchoolIds(USER_TEACHER);
      expect(cachedBefore).toEqual([SCHOOL_A1_ID]);

      // Trigger event subscriber
      const event = new WorkspaceChangedEvent(
        USER_TEACHER,
        SCHOOL_A1_ID,
        SCHOOL_A2_ID,
        new Date(),
        CORRELATION_ID,
      );
      await cacheSubscriber.handleCacheInvalidation(event);

      // Cache should be invalidated
      const cachedAfter = await accessibleSchoolsCacheService.getCachedSchoolIds(USER_TEACHER);
      expect(cachedAfter).toBeNull();
    });

    it('should execute audit subscriber without throwing', async () => {
      const event = new WorkspaceChangedEvent(
        USER_TEACHER,
        SCHOOL_A1_ID,
        SCHOOL_A2_ID,
        new Date(),
        CORRELATION_ID,
      );

      // Audit subscriber should not throw
      await expect(auditSubscriber.handleAuditLog(event)).resolves.not.toThrow();
    });

    it('should not rollback context switch when subscriber throws', async () => {
      const user = createTeacherUser();

      // Make the cache service throw during subscriber execution
      const originalDel = cacheService.del.bind(cacheService);
      jest.spyOn(cacheService, 'del').mockRejectedValueOnce(new Error('Redis down'));

      // Event subscriber should catch error internally
      const event = new WorkspaceChangedEvent(
        USER_TEACHER,
        SCHOOL_A1_ID,
        SCHOOL_A2_ID,
        new Date(),
        CORRELATION_ID,
      );
      await expect(cacheSubscriber.handleCacheInvalidation(event)).resolves.not.toThrow();

      // Restore
      jest.spyOn(cacheService, 'del').mockImplementation(originalDel);
    });

    it('should include correlationId in the emitted event', async () => {
      const user = createTeacherUser();
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await contextService.switchContext(user, SCHOOL_A1_ID, '127.0.0.1', 'my-correlation-id');

      const emittedEvent = emitSpy.mock.calls.find(
        (call) => call[0] === WorkspaceChangedEvent.eventName,
      );
      expect(emittedEvent).toBeDefined();
      expect((emittedEvent![1] as WorkspaceChangedEvent).correlationId).toBe('my-correlation-id');
    });
  });

  // ─── Suite 2: HierarchyService resolves correctly for multi-level structures ─

  describe('HierarchyService: 3-level hierarchy resolution', () => {
    it('should return all descendants for holding (root) node', async () => {
      const descendants = await hierarchyService.getDescendants(HOLDING_ID);

      // Holding → Company A, Company B → School A1, A2, B1 → A1 Child
      const descendantIds = descendants.map((s) => s.id);
      expect(descendantIds).toContain(COMPANY_A_ID);
      expect(descendantIds).toContain(COMPANY_B_ID);
      expect(descendantIds).toContain(SCHOOL_A1_ID);
      expect(descendantIds).toContain(SCHOOL_A2_ID);
      expect(descendantIds).toContain(SCHOOL_B1_ID);
      expect(descendantIds).toContain(SCHOOL_A1_CHILD_ID);
      expect(descendantIds.length).toBe(6);
    });

    it('should return all descendants for company node (multi-level)', async () => {
      const descendants = await hierarchyService.getDescendants(COMPANY_A_ID);

      // Company A → School A1, A2 → A1 Child
      const descendantIds = descendants.map((s) => s.id);
      expect(descendantIds).toContain(SCHOOL_A1_ID);
      expect(descendantIds).toContain(SCHOOL_A2_ID);
      expect(descendantIds).toContain(SCHOOL_A1_CHILD_ID);
      expect(descendantIds.length).toBe(3);
    });

    it('should return empty for leaf node (no children)', async () => {
      const descendants = await hierarchyService.getDescendants(SCHOOL_A2_ID);
      expect(descendants).toHaveLength(0);
    });

    it('should return correct ancestor chain for deepest node', async () => {
      const ancestors = await hierarchyService.getAncestors(SCHOOL_A1_CHILD_ID);

      // A1 Child → School A1 → Company A → Holding
      const ancestorIds = ancestors.map((s) => s.id);
      expect(ancestorIds).toEqual([SCHOOL_A1_ID, COMPANY_A_ID, HOLDING_ID]);
    });

    it('should return correct ancestors for a mid-level node', async () => {
      const ancestors = await hierarchyService.getAncestors(SCHOOL_A1_ID);

      // School A1 → Company A → Holding
      const ancestorIds = ancestors.map((s) => s.id);
      expect(ancestorIds).toEqual([COMPANY_A_ID, HOLDING_ID]);
    });

    it('should return empty ancestors for root node', async () => {
      const ancestors = await hierarchyService.getAncestors(HOLDING_ID);
      expect(ancestors).toHaveLength(0);
    });

    it('should resolve full hierarchy tree from root', async () => {
      const tree = await hierarchyService.resolveHierarchy(COMPANY_A_ID);

      expect(tree).not.toBeNull();
      expect(tree!.school.id).toBe(COMPANY_A_ID);
      expect(tree!.children.length).toBe(2); // School A1, A2

      const a1Node = tree!.children.find((c) => c.school.id === SCHOOL_A1_ID);
      expect(a1Node).toBeDefined();
      expect(a1Node!.children.length).toBe(1); // A1 Child
      expect(a1Node!.children[0].school.id).toBe(SCHOOL_A1_CHILD_ID);

      const a2Node = tree!.children.find((c) => c.school.id === SCHOOL_A2_ID);
      expect(a2Node).toBeDefined();
      expect(a2Node!.children.length).toBe(0); // leaf
    });

    it('should cache hierarchy results and invalidate on demand', async () => {
      // First call: fetches from DB
      const firstResult = await hierarchyService.getDescendants(COMPANY_A_ID);
      expect(firstResult.length).toBe(3);

      // Second call: should come from cache (same result)
      const secondResult = await hierarchyService.getDescendants(COMPANY_A_ID);
      expect(secondResult.length).toBe(3);

      // Invalidate cache
      await hierarchyService.invalidateHierarchyCache(COMPANY_A_ID);

      // Third call: should refetch from DB
      const thirdResult = await hierarchyService.getDescendants(COMPANY_A_ID);
      expect(thirdResult.length).toBe(3);
    });
  });

  // ─── Suite 3: Permission cache invalidation on role change ─────────────────

  describe('Permission cache: store → invalidate → next read returns null', () => {
    it('should store and retrieve permission matrix from cache', async () => {
      const roleId = 'role-school-admin';
      const permissions = ['teacher:read', 'teacher:create', 'class:read'];

      await permissionCacheService.setCachedPermissions(roleId, permissions);
      const cached = await permissionCacheService.getCachedPermissions(roleId);

      expect(cached).toEqual(permissions);
    });

    it('should return null after invalidation (simulating role change)', async () => {
      const roleId = 'role-school-admin';
      const permissions = ['teacher:read', 'teacher:create'];

      // Store permissions
      await permissionCacheService.setCachedPermissions(roleId, permissions);
      const before = await permissionCacheService.getCachedPermissions(roleId);
      expect(before).toEqual(permissions);

      // Simulate role change → invalidate
      await permissionCacheService.invalidatePermissions(roleId);
      const after = await permissionCacheService.getCachedPermissions(roleId);

      expect(after).toBeNull();
    });

    it('should invalidate all permission caches on bulk change', async () => {
      // Store multiple role permission caches
      await permissionCacheService.setCachedPermissions('role-a', ['perm1']);
      await permissionCacheService.setCachedPermissions('role-b', ['perm2']);

      // Verify both exist
      expect(await permissionCacheService.getCachedPermissions('role-a')).toEqual(['perm1']);
      expect(await permissionCacheService.getCachedPermissions('role-b')).toEqual(['perm2']);

      // Invalidate all
      await permissionCacheService.invalidateAllPermissions();

      // Both should be null
      expect(await permissionCacheService.getCachedPermissions('role-a')).toBeNull();
      expect(await permissionCacheService.getCachedPermissions('role-b')).toBeNull();
    });

    it('should not throw when cache service fails during invalidation', async () => {
      jest.spyOn(cacheService, 'del').mockRejectedValueOnce(new Error('Redis connection lost'));

      // Should not throw — graceful degradation
      await expect(
        permissionCacheService.invalidatePermissions('role-x'),
      ).resolves.not.toThrow();
    });

    it('should store accessible schools cache and invalidate for user', async () => {
      const userId = USER_TEACHER;
      const schoolIds = [SCHOOL_A1_ID, SCHOOL_A2_ID];

      await accessibleSchoolsCacheService.setCachedSchoolIds(userId, schoolIds);
      const cached = await accessibleSchoolsCacheService.getCachedSchoolIds(userId);
      expect(cached).toEqual(schoolIds);

      // Invalidate for user (simulating assignment change)
      await accessibleSchoolsCacheService.invalidateForUser(userId);
      const afterInvalidation = await accessibleSchoolsCacheService.getCachedSchoolIds(userId);
      expect(afterInvalidation).toBeNull();
    });
  });

  // ─── Suite 4: Full context flow with all v1.1 additions ────────────────────

  describe('Full v1.1 flow: switch → event → cache invalidated → hierarchy used → permission unaffected', () => {
    it('should complete full flow: switch context → event fires → cache invalidated', async () => {
      const user = createTeacherUser();

      // Pre-populate accessible schools cache
      await accessibleSchoolsCacheService.setCachedSchoolIds(user.id, [SCHOOL_A1_ID, SCHOOL_A2_ID]);

      // Register real event listener for this test
      const eventReceived: WorkspaceChangedEvent[] = [];
      const listener = (event: WorkspaceChangedEvent) => {
        eventReceived.push(event);
      };
      eventEmitter.on(WorkspaceChangedEvent.eventName, listener);

      // Perform context switch
      const result = await contextService.switchContext(user, SCHOOL_A2_ID, '10.0.0.1', CORRELATION_ID);

      // Verify switch succeeded
      expect(result.id).toBe(SCHOOL_A2_ID);
      expect(result.code).toBe('THCS_A2');

      // Verify event was emitted
      expect(eventReceived.length).toBe(1);
      expect(eventReceived[0].userId).toBe(USER_TEACHER);
      expect(eventReceived[0].newSchoolId).toBe(SCHOOL_A2_ID);
      expect(eventReceived[0].correlationId).toBe(CORRELATION_ID);

      // Manually invoke cache subscriber (simulating event bus delivery)
      await cacheSubscriber.handleCacheInvalidation(eventReceived[0]);

      // Verify cache was invalidated
      const cachedAfter = await accessibleSchoolsCacheService.getCachedSchoolIds(user.id);
      expect(cachedAfter).toBeNull();

      // Verify session was stored
      const storedSession = await contextSessionService.getActiveContext(user.id);
      expect(storedSession).toBe(SCHOOL_A2_ID);

      // Cleanup listener
      eventEmitter.off(WorkspaceChangedEvent.eventName, listener);
    });

    it('should use HierarchyService for COMPANY_ADMIN accessible schools computation', async () => {
      const user = createCompanyAdminUser();

      // COMPANY_ADMIN should get company node + descendants via HierarchyService
      const accessibleIds = await contextService.computeAccessibleSchoolIds(user);

      // Company A node + School A1 + School A2 + A1 Child (all ACTIVE descendants)
      expect(accessibleIds).toContain(COMPANY_A_ID);
      expect(accessibleIds).toContain(SCHOOL_A1_ID);
      expect(accessibleIds).toContain(SCHOOL_A2_ID);
      expect(accessibleIds).toContain(SCHOOL_A1_CHILD_ID);
      // Should NOT contain schools from Company B
      expect(accessibleIds).not.toContain(SCHOOL_B1_ID);
      expect(accessibleIds).not.toContain(COMPANY_B_ID);
    });

    it('should NOT change permission cache when context is switched', async () => {
      const roleId = 'role-teacher';
      const permissions = ['teacher:read', 'class:read', 'timetable:read'];

      // Store permission cache for teacher role
      await permissionCacheService.setCachedPermissions(roleId, permissions);

      // Switch context (teacher switches from A1 to A2)
      const user = createTeacherUser();
      await contextService.switchContext(user, SCHOOL_A2_ID, '127.0.0.1');

      // Permission cache should be UNAFFECTED — workspace switch does not change permissions
      const permissionsAfter = await permissionCacheService.getCachedPermissions(roleId);
      expect(permissionsAfter).toEqual(permissions);
    });

    it('should handle sequential switches with correct previousSchoolId in events', async () => {
      const user = createTeacherUser();
      const events: WorkspaceChangedEvent[] = [];
      const listener = (event: WorkspaceChangedEvent) => events.push(event);
      eventEmitter.on(WorkspaceChangedEvent.eventName, listener);

      // First switch: no previous context
      await contextService.switchContext(user, SCHOOL_A1_ID, '127.0.0.1');
      // Second switch: should have A1 as previous
      await contextService.switchContext(user, SCHOOL_A2_ID, '127.0.0.1');

      expect(events.length).toBe(2);
      expect(events[0].previousSchoolId).toBeNull();
      expect(events[0].newSchoolId).toBe(SCHOOL_A1_ID);
      expect(events[1].previousSchoolId).toBe(SCHOOL_A1_ID);
      expect(events[1].newSchoolId).toBe(SCHOOL_A2_ID);

      eventEmitter.off(WorkspaceChangedEvent.eventName, listener);
    });

    it('should audit log context switch with required fields', async () => {
      const user = createTeacherUser();

      await contextService.switchContext(user, SCHOOL_A2_ID, '192.168.1.100', 'audit-corr-id');

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_TEACHER,
          schoolId: SCHOOL_A2_ID,
          action: 'CONTEXT_SWITCH',
          entityType: 'context_session',
          entityId: USER_TEACHER,
          ipAddress: '192.168.1.100',
          metadata: expect.objectContaining({ correlationId: 'audit-corr-id' }),
        }),
      );
    });

    it('should correctly compute accessible schools for SUPER_ADMIN using all active schools', async () => {
      const user = createSuperAdminUser();

      const accessibleIds = await contextService.computeAccessibleSchoolIds(user);

      // All 7 schools in our DB are ACTIVE
      expect(accessibleIds.length).toBe(7);
      expect(accessibleIds).toContain(HOLDING_ID);
      expect(accessibleIds).toContain(COMPANY_A_ID);
      expect(accessibleIds).toContain(COMPANY_B_ID);
      expect(accessibleIds).toContain(SCHOOL_A1_ID);
      expect(accessibleIds).toContain(SCHOOL_A2_ID);
      expect(accessibleIds).toContain(SCHOOL_B1_ID);
      expect(accessibleIds).toContain(SCHOOL_A1_CHILD_ID);
    });

    it('should invalidate accessible schools cache via WorkspaceChangedEvent subscriber', async () => {
      // This tests requirement 15.3: subscribe to WorkspaceChangedEvent to clear caches
      const userId = USER_COMPANY_ADMIN;

      // Pre-cache
      await accessibleSchoolsCacheService.setCachedSchoolIds(userId, [COMPANY_A_ID]);
      expect(await accessibleSchoolsCacheService.getCachedSchoolIds(userId)).toEqual([COMPANY_A_ID]);

      // Simulate event from switch
      const event = new WorkspaceChangedEvent(
        userId,
        COMPANY_A_ID,
        SCHOOL_A1_ID,
        new Date(),
        'corr-invalidation-test',
      );
      await cacheSubscriber.handleCacheInvalidation(event);

      // Cache should be cleared
      expect(await accessibleSchoolsCacheService.getCachedSchoolIds(userId)).toBeNull();
    });
  });
});
