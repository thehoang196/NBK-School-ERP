/**
 * Feature: workspace-context-switcher, Property 17: Audit log on context switch
 *
 * Property: For any successful context switch, the system SHALL write an audit entry
 * containing userId, previousSchoolId, newSchoolId, timestamp, and ipAddress
 * to the audit_logs table.
 *
 * **Validates: Requirements 10.1**
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
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';

describe('Feature: workspace-context-switcher, Property 17: Audit log on context switch', () => {
  let service: ContextService;
  let schoolRepository: { findById: jest.Mock };
  let schoolEntityRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let teacherSchoolAssignmentService: { getAccessibleSchoolIds: jest.Mock };
  let contextSessionService: {
    getActiveContext: jest.Mock;
    setActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
  };
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

  /** Arbitrary for roles that can switch context (multi-school roles) */
  const multiSchoolRoleArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.TEACHER,
  );

  /** Arbitrary for any role (including single-school roles that have the target in accessible list) */
  const anyRoleArb = fc.constantFrom(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.TEACHER,
    UserRole.SCHOOL_ADMIN,
    UserRole.HR,
    UserRole.SCHEDULER,
    UserRole.VIEWER,
  );

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(() => {
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

    contextSessionService = {
      getActiveContext: jest.fn().mockResolvedValue(null),
      setActiveContext: jest.fn().mockResolvedValue(undefined),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new ContextService(
      schoolRepository as any,
      schoolEntityRepository as any,
      teacherSchoolAssignmentService as any,
      contextSessionService as any,
      auditLogService as any,
      { emit: jest.fn() } as any,
    );

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Property 17: Audit log on context switch ───────────────────────────────

  describe('Property 17: Every successful switch produces audit entry with all required fields', () => {
    it('should write audit entry with userId, previousSchoolId, newSchoolId, and ipAddress for EVERY successful switch regardless of role', async () => {
      await fc.assert(
        fc.asyncProperty(
          anyRoleArb,
          uuidArb, // userId
          uuidArb, // targetSchoolId (to switch to)
          uuidArb, // previousSchoolId (existing context in session)
          ipAddressArb, // ipAddress
          async (role, userId, targetSchoolId, previousSchoolId, ipAddress) => {
            // Reset mocks for each iteration
            auditLogService.log.mockClear();
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            schoolEntityRepository.createQueryBuilder.mockReset();
            contextSessionService.getActiveContext.mockReset();
            contextSessionService.setActiveContext.mockReset();

            // Arrange: the target school exists and is ACTIVE
            const targetSchool = {
              id: targetSchoolId,
              code: 'TGT01',
              name: 'Target School',
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            // Setup the user with proper fields for computeAccessibleSchoolIds to include targetSchoolId
            const user: ContextJwtUser = {
              id: userId,
              role,
              schoolId: targetSchoolId, // For single-school roles, JWT schoolId = target
              accessibleSchoolIds: [targetSchoolId], // For TEACHER
              companySchoolId: targetSchoolId, // For COMPANY_ADMIN (company node)
            };

            // Mock computeAccessibleSchoolIds to return targetSchoolId regardless of role
            // We need to mock the underlying calls that computeAccessibleSchoolIds makes:
            if (role === UserRole.SUPER_ADMIN) {
              // SUPER_ADMIN: schoolEntityRepository.find returns active schools including target
              schoolEntityRepository.find.mockResolvedValue([targetSchool]);
            } else if (role === UserRole.COMPANY_ADMIN) {
              // COMPANY_ADMIN: findById for companySchool + schoolEntityRepository.find for children
              schoolRepository.findById.mockImplementation(async (id: string) => {
                if (id === targetSchoolId) return targetSchool;
                return null;
              });
              schoolEntityRepository.find.mockResolvedValue([]);
            } else if (role === UserRole.TEACHER) {
              // TEACHER: uses accessibleSchoolIds from JWT, filterActiveSchoolIds returns target
              const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([targetSchool]),
              };
              schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
            } else {
              // Single-school roles: schoolRepository.findById returns target school (ACTIVE)
              schoolRepository.findById.mockImplementation(async (id: string) => {
                if (id === targetSchoolId) return targetSchool;
                return null;
              });
            }

            // After computeAccessibleSchoolIds, switchContext calls findById for the target school
            // For roles that don't use findById in computeAccessibleSchoolIds, we set it here
            if (role === UserRole.SUPER_ADMIN || role === UserRole.TEACHER) {
              schoolRepository.findById.mockResolvedValue(targetSchool);
            }

            // Mock previous context in session
            contextSessionService.getActiveContext.mockResolvedValue(previousSchoolId);
            contextSessionService.setActiveContext.mockResolvedValue(undefined);

            // Act: execute the context switch
            const result = await service.switchContext(user, targetSchoolId, ipAddress);

            // Assert: switch was successful
            expect(result).toEqual({
              id: targetSchoolId,
              code: 'TGT01',
              name: 'Target School',
            });

            // Property 17 assertion: auditLogService.log MUST have been called exactly once
            expect(auditLogService.log).toHaveBeenCalledTimes(1);

            const auditCall = auditLogService.log.mock.calls[0][0];

            // Required field: userId
            expect(auditCall.userId).toBe(userId);

            // Required field: action
            expect(auditCall.action).toBe('CONTEXT_SWITCH');

            // Required field: entityType
            expect(auditCall.entityType).toBe('context_session');

            // Required field: entityId = userId
            expect(auditCall.entityId).toBe(userId);

            // Required field: changes must contain previousSchoolId and newSchoolId
            expect(auditCall.changes).toBeDefined();
            expect(auditCall.changes.previousSchoolId).toBeDefined();
            expect(auditCall.changes.previousSchoolId.old).toBe(previousSchoolId);
            expect(auditCall.changes.previousSchoolId.new).toBe(targetSchoolId);
            expect(auditCall.changes.newSchoolId).toBeDefined();
            expect(auditCall.changes.newSchoolId.new).toBe(targetSchoolId);

            // Required field: ipAddress
            expect(auditCall.ipAddress).toBe(ipAddress);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should write audit entry with null previousSchoolId when no prior session exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          multiSchoolRoleArb,
          uuidArb, // userId
          uuidArb, // targetSchoolId
          ipAddressArb, // ipAddress
          async (role, userId, targetSchoolId, ipAddress) => {
            // Reset mocks
            auditLogService.log.mockClear();
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            schoolEntityRepository.createQueryBuilder.mockReset();
            contextSessionService.getActiveContext.mockReset();
            contextSessionService.setActiveContext.mockReset();

            const targetSchool = {
              id: targetSchoolId,
              code: 'NEW01',
              name: 'New School',
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

            // Mock to make target accessible
            if (role === UserRole.SUPER_ADMIN) {
              schoolEntityRepository.find.mockResolvedValue([targetSchool]);
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
            }

            if (role === UserRole.SUPER_ADMIN || role === UserRole.TEACHER) {
              schoolRepository.findById.mockResolvedValue(targetSchool);
            }

            // NO previous session exists
            contextSessionService.getActiveContext.mockResolvedValue(null);
            contextSessionService.setActiveContext.mockResolvedValue(undefined);

            // Act
            const result = await service.switchContext(user, targetSchoolId, ipAddress);

            // Assert switch success
            expect(result.id).toBe(targetSchoolId);

            // Property 17: audit log is written even when no previous session
            expect(auditLogService.log).toHaveBeenCalledTimes(1);

            const auditCall = auditLogService.log.mock.calls[0][0];

            // previousSchoolId should be null when no prior session
            expect(auditCall.changes.previousSchoolId.old).toBeNull();
            expect(auditCall.changes.newSchoolId.new).toBe(targetSchoolId);

            // All other required fields still present
            expect(auditCall.userId).toBe(userId);
            expect(auditCall.action).toBe('CONTEXT_SWITCH');
            expect(auditCall.entityType).toBe('context_session');
            expect(auditCall.entityId).toBe(userId);
            expect(auditCall.ipAddress).toBe(ipAddress);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include audit entry for every successful switch regardless of IP address format', async () => {
      // Test with various IP formats including IPv6-style and loopback
      const extendedIpArb = fc.oneof(
        ipAddressArb, // standard IPv4
        fc.constant('127.0.0.1'), // loopback
        fc.constant('::1'), // IPv6 loopback
        fc.constant('::ffff:192.168.1.1'), // IPv4-mapped IPv6
        fc.constant('10.0.0.1'),
        fc.constant('192.168.0.100'),
        fc.constant('172.16.254.1'),
      );

      await fc.assert(
        fc.asyncProperty(
          uuidArb, // userId
          uuidArb, // targetSchoolId
          extendedIpArb, // ipAddress (various formats)
          async (userId, targetSchoolId, ipAddress) => {
            // Reset mocks
            auditLogService.log.mockClear();
            schoolRepository.findById.mockReset();
            schoolEntityRepository.find.mockReset();
            contextSessionService.getActiveContext.mockReset();
            contextSessionService.setActiveContext.mockReset();

            const targetSchool = {
              id: targetSchoolId,
              code: 'IP01',
              name: 'IP Test School',
              status: SchoolStatus.ACTIVE,
              parentSchoolId: null,
              deletedAt: null,
            } as unknown as SchoolEntity;

            const user: ContextJwtUser = {
              id: userId,
              role: UserRole.SUPER_ADMIN,
              schoolId: null,
            };

            // SUPER_ADMIN: all active schools
            schoolEntityRepository.find.mockResolvedValue([targetSchool]);
            schoolRepository.findById.mockResolvedValue(targetSchool);
            contextSessionService.getActiveContext.mockResolvedValue(null);
            contextSessionService.setActiveContext.mockResolvedValue(undefined);

            // Act
            const result = await service.switchContext(user, targetSchoolId, ipAddress);

            // Assert
            expect(result.id).toBe(targetSchoolId);
            expect(auditLogService.log).toHaveBeenCalledTimes(1);

            const auditCall = auditLogService.log.mock.calls[0][0];
            // ipAddress is passed through exactly as provided
            expect(auditCall.ipAddress).toBe(ipAddress);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
