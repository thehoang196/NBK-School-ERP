/**
 * Feature: workspace-context-switcher, Property 10: Context resolution priority
 *
 * **Property 10: Context resolution priority** — Verify strict priority order:
 *   header → session → JWT fallback
 *
 * For any authenticated request, the TenantMiddleware SHALL resolve the active schoolId
 * using this strict priority:
 * (1) if X-School-Id header is present and valid → use header value
 * (2) else if Redis context:session:{userId} contains a schoolId in user's accessible list → use session value
 * (3) else → use JWT schoolId (or bypass for SUPER_ADMIN)
 *
 * **Validates: Requirements 3.2, 9.1, 12.1, 12.2**
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
import { TenantMiddleware } from './tenant.middleware';
import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantRlsService } from './tenant-rls.service';
import { UserRole } from '../enums/role.enum';
import { Request, Response, NextFunction } from 'express';

/**
 * Multi-school roles that can use X-School-Id header and context sessions.
 */
const MULTI_SCHOOL_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.HOLDING_ADMIN,
];

describe('Feature: workspace-context-switcher, Property 10: Context resolution priority', () => {
  // ─── Shared Mocks ──────────────────────────────────────────────────────────

  let middleware: TenantMiddleware;
  let tenantContextService: TenantContextService;
  let tenantAuditService: jest.Mocked<TenantAuditService>;
  let tenantRlsService: jest.Mocked<TenantRlsService>;
  let schoolRepository: { findOne: jest.Mock };
  let contextSessionService: {
    getActiveContext: jest.Mock;
    setActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
  };
  let contextService: {
    computeAccessibleSchoolIds: jest.Mock;
  };

  // ─── Arbitraries ────────────────────────────────────────────────────────────

  const uuidArb = fc.uuid().map((u) => u.toLowerCase());

  /** Arbitrary for multi-school roles (SUPER_ADMIN, COMPANY_ADMIN, HOLDING_ADMIN) */
  const multiSchoolRoleArb = fc.constantFrom(...MULTI_SCHOOL_ROLES);

  /** Arbitrary for TEACHER with multiple schools */
  const teacherMultiSchoolArb = fc.record({
    role: fc.constant(UserRole.TEACHER),
    accessibleSchoolIds: fc.array(uuidArb, { minLength: 2, maxLength: 10 }),
  });

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(() => {
    tenantContextService = new TenantContextService();

    tenantAuditService = {
      logImpersonation: jest.fn(),
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;

    tenantRlsService = {
      setSessionSchoolId: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TenantRlsService>;

    schoolRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'mock-school' }),
    };

    contextSessionService = {
      getActiveContext: jest.fn().mockResolvedValue(null),
      setActiveContext: jest.fn().mockResolvedValue(undefined),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
    };

    contextService = {
      computeAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    middleware = new TenantMiddleware(
      tenantContextService,
      tenantAuditService,
      tenantRlsService,
      schoolRepository as any,
      contextSessionService as any,
      contextService as any,
    );

    // Suppress logger noise in tests
    jest.spyOn((middleware as any).logger, 'warn').mockImplementation();
    jest.spyOn((middleware as any).logger, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Creates a mock Express request with the given user and optional headers.
   */
  function createMockRequest(
    user: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Request {
    return {
      user,
      headers: { ...headers },
      method: 'GET',
    } as unknown as Request;
  }

  /**
   * Creates a mock Express response.
   */
  function createMockResponse(): Response {
    return {} as unknown as Response;
  }

  /**
   * Captures the TenantStore from the middleware by intercepting tenantContext.run().
   * Returns the resolved schoolId from the TenantStore.
   */
  async function getResolvedSchoolId(req: Request): Promise<string | null> {
    const res = createMockResponse();
    let resolvedSchoolId: string | null = null;

    // Spy on tenantContext.run to capture the store passed to it
    const originalRun = tenantContextService.run.bind(tenantContextService);
    jest.spyOn(tenantContextService, 'run').mockImplementation((store, callback) => {
      resolvedSchoolId = store.schoolId;
      callback();
    });

    const next: NextFunction = jest.fn();
    await middleware.use(req, res, next);

    return resolvedSchoolId;
  }

  // ─── Property 10: Priority 1 — Header takes highest priority ────────────────

  describe('Priority 1: X-School-Id header present and valid → use header value', () => {
    it('For multi-school users, when header is present and school is accessible, resolved schoolId equals header value', async () => {
      await fc.assert(
        fc.asyncProperty(
          multiSchoolRoleArb,
          uuidArb, // userId
          uuidArb, // headerSchoolId
          uuidArb, // sessionSchoolId (should be ignored)
          uuidArb, // jwtSchoolId (should be ignored)
          async (role, userId, headerSchoolId, sessionSchoolId, jwtSchoolId) => {
            // Setup: all three sources available
            const user = {
              id: userId,
              userId,
              role,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: [headerSchoolId, sessionSchoolId, jwtSchoolId],
            };

            // computeAccessibleSchoolIds returns a list that includes the header value
            contextService.computeAccessibleSchoolIds.mockResolvedValue([
              headerSchoolId,
              sessionSchoolId,
              jwtSchoolId,
            ]);

            // Session has a valid schoolId (should be ignored because header wins)
            contextSessionService.getActiveContext.mockResolvedValue(sessionSchoolId);

            // School exists in DB (for SUPER_ADMIN validation)
            schoolRepository.findOne.mockResolvedValue({ id: headerSchoolId });

            const req = createMockRequest(user, {
              'x-school-id': headerSchoolId,
            });

            const resolvedSchoolId = await getResolvedSchoolId(req);

            // Property: header value wins over session and JWT
            expect(resolvedSchoolId).toBe(headerSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('For TEACHER with multiple schools, when header is present and accessible, resolved schoolId equals header value', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          fc.array(uuidArb, { minLength: 3, maxLength: 8 }), // accessible schools
          async (userId, rawAccessibleSchools) => {
            const accessibleSchools = [...new Set(rawAccessibleSchools)];
            if (accessibleSchools.length < 3) return; // need at least 3 distinct IDs

            const headerSchoolId = accessibleSchools[0];
            const sessionSchoolId = accessibleSchools[1];
            const jwtSchoolId = accessibleSchools[2];

            const user = {
              id: userId,
              userId,
              role: UserRole.TEACHER,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: accessibleSchools,
            };

            contextService.computeAccessibleSchoolIds.mockResolvedValue(accessibleSchools);
            contextSessionService.getActiveContext.mockResolvedValue(sessionSchoolId);

            const req = createMockRequest(user, {
              'x-school-id': headerSchoolId,
            });

            const resolvedSchoolId = await getResolvedSchoolId(req);

            // Property: header value takes priority
            expect(resolvedSchoolId).toBe(headerSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 10: Priority 2 — Session used when no header ──────────────────

  describe('Priority 2: No header, session exists with accessible schoolId → use session value', () => {
    it('For multi-school users, when no header and session has accessible schoolId, resolved equals session value', async () => {
      await fc.assert(
        fc.asyncProperty(
          multiSchoolRoleArb,
          uuidArb, // userId
          uuidArb, // sessionSchoolId
          uuidArb, // jwtSchoolId (should be ignored)
          async (role, userId, sessionSchoolId, jwtSchoolId) => {
            // Ensure sessionSchoolId != jwtSchoolId to distinguish sources
            if (sessionSchoolId === jwtSchoolId) return;

            const user = {
              id: userId,
              userId,
              role,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: [sessionSchoolId, jwtSchoolId],
            };

            // No header
            contextService.computeAccessibleSchoolIds.mockResolvedValue([
              sessionSchoolId,
              jwtSchoolId,
            ]);

            // Session returns a valid accessible schoolId
            contextSessionService.getActiveContext.mockResolvedValue(sessionSchoolId);

            const req = createMockRequest(user);

            const resolvedSchoolId = await getResolvedSchoolId(req);

            // Property: session value used when no header present
            expect(resolvedSchoolId).toBe(sessionSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('For TEACHER with multiple schools, session value used when no header', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          fc.array(uuidArb, { minLength: 2, maxLength: 8 }), // accessible schools
          async (userId, rawAccessibleSchools) => {
            const accessibleSchools = [...new Set(rawAccessibleSchools)];
            if (accessibleSchools.length < 2) return; // need at least 2 distinct

            const sessionSchoolId = accessibleSchools[0];
            const jwtSchoolId = accessibleSchools[1];

            const user = {
              id: userId,
              userId,
              role: UserRole.TEACHER,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: accessibleSchools,
            };

            contextService.computeAccessibleSchoolIds.mockResolvedValue(accessibleSchools);
            contextSessionService.getActiveContext.mockResolvedValue(sessionSchoolId);

            const req = createMockRequest(user);

            const resolvedSchoolId = await getResolvedSchoolId(req);

            // Property: session used when no header
            expect(resolvedSchoolId).toBe(sessionSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 10: Priority 3 — JWT fallback when no header and no session ───

  describe('Priority 3: No header, no session → use JWT schoolId (or bypass for SUPER_ADMIN)', () => {
    it('For non-SUPER_ADMIN multi-school roles, when no header and no session, resolved equals JWT schoolId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(UserRole.COMPANY_ADMIN, UserRole.HOLDING_ADMIN),
          uuidArb, // userId
          uuidArb, // jwtSchoolId
          async (role, userId, jwtSchoolId) => {
            const user = {
              id: userId,
              userId,
              role,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: [jwtSchoolId],
            };

            // No session
            contextSessionService.getActiveContext.mockResolvedValue(null);
            contextService.computeAccessibleSchoolIds.mockResolvedValue([jwtSchoolId]);

            const req = createMockRequest(user);

            const resolvedSchoolId = await getResolvedSchoolId(req);

            // Property: JWT schoolId used as fallback
            expect(resolvedSchoolId).toBe(jwtSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('For SUPER_ADMIN, when no header and no session, resolved is null (bypass mode)', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          async (userId) => {
            const user = {
              id: userId,
              userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
              accessibleSchoolIds: [],
            };

            // No session
            contextSessionService.getActiveContext.mockResolvedValue(null);
            contextService.computeAccessibleSchoolIds.mockResolvedValue([]);

            const req = createMockRequest(user);

            const resolvedSchoolId = await getResolvedSchoolId(req);

            // Property: SUPER_ADMIN without header/session gets null (bypass)
            expect(resolvedSchoolId).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('For TEACHER with multiple schools, when no header and no session, resolved equals JWT schoolId', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          fc.array(uuidArb, { minLength: 2, maxLength: 8 }), // accessible schools
          async (userId, rawAccessibleSchools) => {
            const accessibleSchools = [...new Set(rawAccessibleSchools)];
            if (accessibleSchools.length < 2) return;

            const jwtSchoolId = accessibleSchools[0];

            const user = {
              id: userId,
              userId,
              role: UserRole.TEACHER,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: accessibleSchools,
            };

            // No session
            contextSessionService.getActiveContext.mockResolvedValue(null);
            contextService.computeAccessibleSchoolIds.mockResolvedValue(accessibleSchools);

            const req = createMockRequest(user);

            const resolvedSchoolId = await getResolvedSchoolId(req);

            // Property: JWT schoolId used as fallback for non-SUPER_ADMIN
            expect(resolvedSchoolId).toBe(jwtSchoolId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 10: Priority ordering — combined scenarios ────────────────────

  describe('Priority ordering: header > session > JWT across arbitrary combinations', () => {
    it('For any multi-school user, the resolved context follows strict priority: header > session > JWT', async () => {
      /**
       * Generate arbitrary combinations of:
       * - headerPresent: boolean (whether X-School-Id header is sent)
       * - sessionPresent: boolean (whether a Redis session exists with accessible schoolId)
       * - All three sources have different schoolIds to distinguish resolution source
       */
      await fc.assert(
        fc.asyncProperty(
          multiSchoolRoleArb,
          uuidArb, // userId
          uuidArb, // headerSchoolId
          uuidArb, // sessionSchoolId
          uuidArb, // jwtSchoolId
          fc.boolean(), // headerPresent
          fc.boolean(), // sessionPresent
          async (
            role,
            userId,
            headerSchoolId,
            sessionSchoolId,
            jwtSchoolId,
            headerPresent,
            sessionPresent,
          ) => {
            // Ensure all three IDs are distinct to tell which source was used
            if (
              headerSchoolId === sessionSchoolId ||
              headerSchoolId === jwtSchoolId ||
              sessionSchoolId === jwtSchoolId
            ) {
              return; // Skip — need distinct IDs to verify priority
            }

            const accessibleSchools = [headerSchoolId, sessionSchoolId, jwtSchoolId];
            const user = {
              id: userId,
              userId,
              role,
              schoolId: jwtSchoolId,
              accessibleSchoolIds: accessibleSchools,
            };

            contextService.computeAccessibleSchoolIds.mockResolvedValue(accessibleSchools);
            schoolRepository.findOne.mockResolvedValue({ id: headerSchoolId });

            // Configure session
            if (sessionPresent) {
              contextSessionService.getActiveContext.mockResolvedValue(sessionSchoolId);
            } else {
              contextSessionService.getActiveContext.mockResolvedValue(null);
            }

            // Configure request (with or without header)
            const headers: Record<string, string> = {};
            if (headerPresent) {
              headers['x-school-id'] = headerSchoolId;
            }

            const req = createMockRequest(user, headers);
            const resolvedSchoolId = await getResolvedSchoolId(req);

            // ─── Verify strict priority ─────────────────────────────────
            if (headerPresent) {
              // Priority 1: Header present → use header value
              expect(resolvedSchoolId).toBe(headerSchoolId);
            } else if (sessionPresent) {
              // Priority 2: No header, session present → use session value
              expect(resolvedSchoolId).toBe(sessionSchoolId);
            } else {
              // Priority 3: No header, no session → JWT fallback
              if (role === UserRole.SUPER_ADMIN) {
                // SUPER_ADMIN fallback is bypass (null)
                expect(resolvedSchoolId).toBeNull();
              } else {
                expect(resolvedSchoolId).toBe(jwtSchoolId);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
