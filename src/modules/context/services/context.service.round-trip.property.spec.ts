/**
 * Feature: workspace-context-switcher, Property 9: Context switch round-trip
 *
 * Property: For any successful context switch to school X, the Redis key
 * `context:session:{userId}` SHALL contain school X's ID, AND a subsequent
 * call to getActiveContext(userId) SHALL return X, AND getCurrentContext(user)
 * SHALL resolve to X.
 *
 * This is an integration property test that verifies ContextService.switchContext()
 * and ContextSessionService work together correctly using an in-memory Map to
 * simulate Redis behavior.
 *
 * **Validates: Requirements 2.2, 2.9, 3.1**
 */

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: jest.fn((str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }),
}));

import * as fc from 'fast-check';
import { Logger } from '@nestjs/common';
import { ContextService, ContextJwtUser } from './context.service';
import { ContextSessionService } from './context-session.service';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { ContextSession } from '../interfaces/context.interfaces';

/**
 * In-memory Redis simulation using a Map.
 * Mimics CacheService behavior for ContextSessionService integration testing.
 */
class InMemoryRedisStore {
  private store = new Map<string, { value: unknown; ttl: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    this.store.set(key, { value, ttl: options?.ttl ?? 0 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Retrieve raw entry (for testing assertions) */
  getRaw(key: string): { value: unknown; ttl: number } | undefined {
    return this.store.get(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('Feature: workspace-context-switcher, Property 9: Context switch round-trip', () => {
  let contextService: ContextService;
  let contextSessionService: ContextSessionService;
  let redisStore: InMemoryRedisStore;
  let schoolRepository: { findById: jest.Mock };
  let schoolEntityRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let teacherSchoolAssignmentService: { getAccessibleSchoolIds: jest.Mock };
  let auditLogService: { log: jest.Mock };

  // ─── Arbitraries ────────────────────────────────────────────────────────────

  const uuidArb = fc.uuid().map((u) => u.toLowerCase());

  /** Arbitrary for IP addresses (IPv4) */
  const ipAddressArb = fc
    .tuple(
      fc.integer({ min: 1, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
    )
    .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

  /** Arbitrary for multi-school roles that can switch context */
  const multiSchoolRoleArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.TEACHER,
  );

  /** Arbitrary for any valid role */
  const anyRoleArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.TEACHER,
    UserRole.SCHOOL_ADMIN,
    UserRole.HR,
    UserRole.SCHEDULER,
    UserRole.VIEWER,
  );

  /** Arbitrary for school code (short string) */
  const schoolCodeArb = fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
      minLength: 2,
      maxLength: 10,
    })
    .map((chars) => chars.join(''));

  /** Arbitrary for school name */
  const schoolNameArb = fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length > 0);

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(() => {
    // Create in-memory Redis store
    redisStore = new InMemoryRedisStore();

    // Create a real ContextSessionService backed by the in-memory store
    const mockCacheService = {
      get: (key: string) => redisStore.get(key),
      set: (key: string, value: unknown, options?: { ttl?: number }) =>
        redisStore.set(key, value, options),
      del: (key: string) => redisStore.del(key),
    };

    contextSessionService = new ContextSessionService(mockCacheService as any);

    // Mock other dependencies
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    schoolRepository = {
      findById: jest.fn().mockResolvedValue(null),
    };

    schoolEntityRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    teacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    contextService = new ContextService(
      schoolRepository as any,
      schoolEntityRepository as any,
      teacherSchoolAssignmentService as any,
      contextSessionService,
      auditLogService as any,
      { emit: jest.fn() } as any,
    );

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    redisStore.clear();
    jest.restoreAllMocks();
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Configure mocks so that a switchContext call for the given user/target will succeed.
   */
  function setupSuccessfulSwitch(
    user: ContextJwtUser,
    targetSchool: SchoolEntity,
  ): void {
    const role = user.role;
    const targetSchoolId = targetSchool.id;

    if (role === UserRole.SUPER_ADMIN) {
      schoolEntityRepository.find.mockResolvedValue([targetSchool]);
      schoolRepository.findById.mockResolvedValue(targetSchool);
    } else if (role === UserRole.COMPANY_ADMIN) {
      schoolRepository.findById.mockImplementation(async (id: string) => {
        if (id === targetSchoolId) return targetSchool;
        return null;
      });
      schoolEntityRepository.find.mockResolvedValue([]);
    } else if (role === UserRole.TEACHER) {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([targetSchool]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      schoolRepository.findById.mockResolvedValue(targetSchool);
    } else {
      // Single-school roles (SCHOOL_ADMIN, HR, SCHEDULER, VIEWER)
      schoolRepository.findById.mockImplementation(async (id: string) => {
        if (id === targetSchoolId) return targetSchool;
        return null;
      });
    }
  }

  // ─── Property 9: Context switch round-trip ──────────────────────────────────

  describe('Property 9: Successful switch to school X results in Redis containing X and subsequent request resolving to X', () => {
    it('after switchContext(user, X), contextSessionService.getActiveContext(userId) SHALL return X', async () => {
      await fc.assert(
        fc.asyncProperty(
          anyRoleArb,
          uuidArb, // userId
          uuidArb, // targetSchoolId
          schoolCodeArb, // school code
          schoolNameArb, // school name
          ipAddressArb,
          async (role, userId, targetSchoolId, schoolCode, schoolName, ipAddress) => {
            // Reset state for each iteration
            redisStore.clear();
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            schoolEntityRepository.createQueryBuilder.mockReset();
            auditLogService.log.mockClear();

            // Arrange: create the target school
            const targetSchool = {
              id: targetSchoolId,
              code: schoolCode,
              name: schoolName,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            // Create user with proper fields for the given role
            const user: ContextJwtUser = {
              id: userId,
              role,
              schoolId: targetSchoolId,
              accessibleSchoolIds: [targetSchoolId],
              companySchoolId: targetSchoolId,
            };

            // Setup mocks for successful switch
            setupSuccessfulSwitch(user, targetSchool);

            // Act: perform context switch
            const result = await contextService.switchContext(user, targetSchoolId, ipAddress);

            // Verify switch was successful
            expect(result.id).toBe(targetSchoolId);

            // ═══════════════════════════════════════════════════════════════
            // PROPERTY 9 ASSERTION 1:
            // contextSessionService.setActiveContext was called with (userId, targetSchoolId)
            // Verified by: the in-memory Redis store now contains the session
            // ═══════════════════════════════════════════════════════════════
            const redisKey = `context:session:${userId}`;
            const storedSession = redisStore.getRaw(redisKey);
            expect(storedSession).toBeDefined();
            expect((storedSession!.value as ContextSession).schoolId).toBe(targetSchoolId);

            // ═══════════════════════════════════════════════════════════════
            // PROPERTY 9 ASSERTION 2:
            // A subsequent getActiveContext(userId) SHALL return targetSchoolId
            // ═══════════════════════════════════════════════════════════════
            const activeContext = await contextSessionService.getActiveContext(userId);
            expect(activeContext).toBe(targetSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('after switchContext(user, X), getCurrentContext(user) SHALL resolve to X', async () => {
      await fc.assert(
        fc.asyncProperty(
          multiSchoolRoleArb,
          uuidArb, // userId
          uuidArb, // targetSchoolId
          schoolCodeArb,
          schoolNameArb,
          ipAddressArb,
          async (role, userId, targetSchoolId, schoolCode, schoolName, ipAddress) => {
            // Reset state
            redisStore.clear();
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            schoolEntityRepository.createQueryBuilder.mockReset();
            auditLogService.log.mockClear();

            // Arrange: target school
            const targetSchool = {
              id: targetSchoolId,
              code: schoolCode,
              name: schoolName,
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            const user: ContextJwtUser = {
              id: userId,
              role,
              schoolId: targetSchoolId,
              accessibleSchoolIds: [targetSchoolId],
              companySchoolId: targetSchoolId,
            };

            // Setup mocks for successful switch
            setupSuccessfulSwitch(user, targetSchool);

            // Act: perform context switch
            const result = await contextService.switchContext(user, targetSchoolId, ipAddress);
            expect(result.id).toBe(targetSchoolId);

            // Now setup mocks for getCurrentContext call
            // getCurrentContext calls:
            // 1. contextSessionService.getActiveContext(userId) - reads from in-memory Redis
            // 2. computeAccessibleSchoolIds(user) - needs mocks
            // 3. schoolRepository.findById(resolvedSchoolId) - needs mock

            // Re-setup mocks for the subsequent getCurrentContext call
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            schoolEntityRepository.createQueryBuilder.mockReset();

            // For computeAccessibleSchoolIds in getCurrentContext
            if (role === UserRole.SUPER_ADMIN) {
              schoolEntityRepository.find.mockResolvedValue([targetSchool]);
            } else if (role === UserRole.COMPANY_ADMIN) {
              schoolRepository.findById.mockImplementation(async (id: string) => {
                if (id === targetSchoolId) return targetSchool;
                return null;
              });
              schoolEntityRepository.find.mockResolvedValue([]);
            } else if (role === UserRole.TEACHER) {
              const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([targetSchool]),
              };
              schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQb);
            }

            // For schoolRepository.findById(resolvedSchoolId) in getCurrentContext
            // This is called after resolving the active context
            if (role !== UserRole.COMPANY_ADMIN) {
              schoolRepository.findById.mockResolvedValue(targetSchool);
            }

            // ═══════════════════════════════════════════════════════════════
            // PROPERTY 9 ASSERTION 3:
            // getCurrentContext(user) SHALL resolve to the switched school
            // ═══════════════════════════════════════════════════════════════
            const currentContext = await contextService.getCurrentContext(user);

            expect(currentContext.activeSchoolId).toBe(targetSchoolId);
            expect(currentContext.activeSchoolName).toBe(schoolName);
            expect(currentContext.activeSchoolCode).toBe(schoolCode);
            expect(currentContext.contextRequired).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('round-trip holds for consecutive switches: switching to Y after X results in Y being active', async () => {
      await fc.assert(
        fc.asyncProperty(
          multiSchoolRoleArb,
          uuidArb, // userId
          uuidArb, // first targetSchoolId (X)
          uuidArb, // second targetSchoolId (Y)
          ipAddressArb,
          async (role, userId, schoolIdX, schoolIdY, ipAddress) => {
            // Reset state
            redisStore.clear();
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            schoolEntityRepository.createQueryBuilder.mockReset();
            auditLogService.log.mockClear();

            const schoolX = {
              id: schoolIdX,
              code: 'SCH_X',
              name: 'School X',
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            const schoolY = {
              id: schoolIdY,
              code: 'SCH_Y',
              name: 'School Y',
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            const user: ContextJwtUser = {
              id: userId,
              role,
              schoolId: schoolIdX,
              accessibleSchoolIds: [schoolIdX, schoolIdY],
              companySchoolId: schoolIdX,
            };

            // Setup mocks for switch to X
            if (role === UserRole.SUPER_ADMIN) {
              schoolEntityRepository.find.mockResolvedValue([schoolX, schoolY]);
              schoolRepository.findById.mockResolvedValue(schoolX);
            } else if (role === UserRole.COMPANY_ADMIN) {
              schoolRepository.findById.mockImplementation(async (id: string) => {
                if (id === schoolIdX) return schoolX;
                if (id === schoolIdY) return schoolY;
                return null;
              });
              schoolEntityRepository.find.mockResolvedValue([schoolY]);
            } else if (role === UserRole.TEACHER) {
              const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([schoolX, schoolY]),
              };
              schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQb);
              schoolRepository.findById.mockResolvedValue(schoolX);
            }

            // Act: first switch to X
            const resultX = await contextService.switchContext(user, schoolIdX, ipAddress);
            expect(resultX.id).toBe(schoolIdX);

            // Verify X is active
            const activeAfterX = await contextSessionService.getActiveContext(userId);
            expect(activeAfterX).toBe(schoolIdX);

            // Re-setup mocks for switch to Y
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            schoolEntityRepository.createQueryBuilder.mockReset();

            if (role === UserRole.SUPER_ADMIN) {
              schoolEntityRepository.find.mockResolvedValue([schoolX, schoolY]);
              schoolRepository.findById.mockResolvedValue(schoolY);
            } else if (role === UserRole.COMPANY_ADMIN) {
              schoolRepository.findById.mockImplementation(async (id: string) => {
                if (id === schoolIdX) return schoolX;
                if (id === schoolIdY) return schoolY;
                return null;
              });
              schoolEntityRepository.find.mockResolvedValue([schoolY]);
            } else if (role === UserRole.TEACHER) {
              const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([schoolX, schoolY]),
              };
              schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQb);
              schoolRepository.findById.mockResolvedValue(schoolY);
            }

            // Act: second switch to Y
            const resultY = await contextService.switchContext(user, schoolIdY, ipAddress);
            expect(resultY.id).toBe(schoolIdY);

            // ═══════════════════════════════════════════════════════════════
            // PROPERTY 9: After second switch, Redis contains Y (not X)
            // and getActiveContext returns Y
            // ═══════════════════════════════════════════════════════════════
            const redisKey = `context:session:${userId}`;
            const storedSession = redisStore.getRaw(redisKey);
            expect(storedSession).toBeDefined();
            expect((storedSession!.value as ContextSession).schoolId).toBe(schoolIdY);

            const activeAfterY = await contextSessionService.getActiveContext(userId);
            expect(activeAfterY).toBe(schoolIdY);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
