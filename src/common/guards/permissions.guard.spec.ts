import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '../enums/permission.enum';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const mockExecutionContext = (user: unknown): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('should allow access when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = mockExecutionContext({ role: 'teacher' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access for super_admin (has all permissions)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.TIMETABLE_PUBLISH]);
    const context = mockExecutionContext({ role: 'super_admin' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user role has required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.TEACHER_READ]);
    const context = mockExecutionContext({ role: 'teacher' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user role lacks required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.TEACHER_DELETE]);
    const context = mockExecutionContext({ role: 'teacher' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny access when user is not present', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.TEACHER_READ]);
    const context = mockExecutionContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny access when user role does not exist in ROLE_PERMISSIONS', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.TEACHER_READ]);
    const context = mockExecutionContext({ role: 'unknown_role' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should require ALL permissions (not just one)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.TEACHER_READ, Permission.TEACHER_DELETE]);
    const context = mockExecutionContext({ role: 'teacher' });
    // teacher has READ but not DELETE
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow scheduler to manage timetable', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.TIMETABLE_CREATE, Permission.TIMETABLE_PUBLISH]);
    const context = mockExecutionContext({ role: 'scheduler' });
    expect(guard.canActivate(context)).toBe(true);
  });
});
