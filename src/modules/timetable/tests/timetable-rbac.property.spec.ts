/**
 * Feature: timetable-management-features, Property 14: Role-based access control
 *
 * **Validates: Requirements 5.1, 5.2, 5.5**
 *
 * Property: For any user and TKB operation, the system SHALL grant access based on:
 * - Import/Save/Edit: only SUPER_ADMIN, SCHOOL_ADMIN, SCHEDULER
 * - Export: only SUPER_ADMIN, SCHOOL_ADMIN, SCHEDULER, TEACHER
 * - View: SUPER_ADMIN, SCHOOL_ADMIN, SCHEDULER, TEACHER, VIEWER
 *
 * Any user with an insufficient role SHALL receive HTTP 403 (guard returns false).
 */
import * as fc from 'fast-check';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/role.enum';

/**
 * Operation categories for TKB features
 */
enum TimetableOperation {
  IMPORT = 'IMPORT',
  SAVE = 'SAVE',
  EDIT = 'EDIT',
  EXPORT = 'EXPORT',
  VIEW = 'VIEW',
}

/**
 * Role-permission matrix as defined by requirements 5.1, 5.2
 */
const PERMISSION_MATRIX: Record<TimetableOperation, UserRole[]> = {
  [TimetableOperation.IMPORT]: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER],
  [TimetableOperation.SAVE]: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER],
  [TimetableOperation.EDIT]: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER],
  [TimetableOperation.EXPORT]: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER],
  [TimetableOperation.VIEW]: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER, UserRole.VIEWER],
};

/**
 * All possible roles
 */
const ALL_ROLES = Object.values(UserRole);

/**
 * All possible operations
 */
const ALL_OPERATIONS = Object.values(TimetableOperation);

describe('Feature: timetable-management-features, Property 14: Role-based access control', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  // Arbitrary: generate a random UserRole
  const roleArb = fc.constantFrom(...ALL_ROLES);

  // Arbitrary: generate a random TimetableOperation
  const operationArb = fc.constantFrom(...ALL_OPERATIONS);

  // Helper: create a mock ExecutionContext with user having a specific role
  function createMockContext(userRole: UserRole): ExecutionContext {
    const mockRequest = {
      user: { role: userRole, id: 'user-id-123', schoolId: 'school-id-456' },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      getArgs: () => [],
      getArgByIndex: () => undefined,
      switchToRpc: () => ({} as ReturnType<ExecutionContext['switchToRpc']>),
      switchToWs: () => ({} as ReturnType<ExecutionContext['switchToWs']>),
      getType: () => 'http' as const,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should ALLOW access when user role is in the allowed roles for the operation', () => {
    fc.assert(
      fc.property(
        roleArb,
        operationArb,
        (role: UserRole, operation: TimetableOperation) => {
          const allowedRoles = PERMISSION_MATRIX[operation];

          // Only test when role IS allowed for this operation
          fc.pre(allowedRoles.includes(role));

          // Mock reflector to return allowed roles for this operation
          jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

          const context = createMockContext(role);
          const result = guard.canActivate(context);

          // Should be granted access
          expect(result).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should DENY access when user role is NOT in the allowed roles for the operation', () => {
    fc.assert(
      fc.property(
        roleArb,
        operationArb,
        (role: UserRole, operation: TimetableOperation) => {
          const allowedRoles = PERMISSION_MATRIX[operation];

          // Only test when role is NOT allowed for this operation
          fc.pre(!allowedRoles.includes(role));

          // Mock reflector to return allowed roles for this operation
          jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

          const context = createMockContext(role);
          const result = guard.canActivate(context);

          // Should be denied access (guard returns false → NestJS translates to 403)
          expect(result).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should ALLOW all roles when no @Roles decorator is set (no restriction)', () => {
    fc.assert(
      fc.property(
        roleArb,
        (role: UserRole) => {
          // Mock reflector to return undefined (no decorator)
          jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

          const context = createMockContext(role);
          const result = guard.canActivate(context);

          // When no roles specified, guard should allow all
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should correctly enforce Import/Save/Edit restriction to SUPER_ADMIN, SCHOOL_ADMIN, SCHEDULER only', () => {
    const writeOperations = [TimetableOperation.IMPORT, TimetableOperation.SAVE, TimetableOperation.EDIT];
    const writeOperationArb = fc.constantFrom(...writeOperations);

    fc.assert(
      fc.property(
        roleArb,
        writeOperationArb,
        (role: UserRole, operation: TimetableOperation) => {
          const allowedRoles = PERMISSION_MATRIX[operation];

          jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

          const context = createMockContext(role);
          const result = guard.canActivate(context);

          if (role === UserRole.TEACHER || role === UserRole.VIEWER) {
            // TEACHER and VIEWER should be denied for write operations
            expect(result).toBe(false);
          } else {
            // SUPER_ADMIN, SCHOOL_ADMIN, SCHEDULER should be allowed
            expect(result).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should correctly enforce Export restriction: VIEWER denied, TEACHER allowed', () => {
    fc.assert(
      fc.property(
        roleArb,
        (role: UserRole) => {
          const allowedRoles = PERMISSION_MATRIX[TimetableOperation.EXPORT];

          jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

          const context = createMockContext(role);
          const result = guard.canActivate(context);

          if (role === UserRole.VIEWER) {
            // VIEWER should be denied for export
            expect(result).toBe(false);
          } else {
            // All other roles should be allowed for export
            expect(result).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should allow ALL roles for View operation', () => {
    fc.assert(
      fc.property(
        roleArb,
        (role: UserRole) => {
          const allowedRoles = PERMISSION_MATRIX[TimetableOperation.VIEW];

          jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

          const context = createMockContext(role);
          const result = guard.canActivate(context);

          // All roles should be allowed for view
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
