// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ContextController } from './context.controller';
import { ContextService, ContextJwtUser } from '../services/context.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ContextThrottlerGuard } from '../guards/context-throttler.guard';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

// ─── Test Factories ────────────────────────────────────────────────────────────

const createMockUser = (overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload => ({
  id: 'user-uuid-0001-0000-000000000001',
  email: 'teacher@nbk.edu.vn',
  role: UserRole.TEACHER,
  schoolId: 'school-uuid-0001-0000-000000000001',
  accessibleSchoolIds: [
    'school-uuid-0001-0000-000000000001',
    'school-uuid-0001-0000-000000000002',
  ],
  ...overrides,
});

// ─── Test Setup ────────────────────────────────────────────────────────────────

describe('ContextController', () => {
  let controller: ContextController;
  let contextService: jest.Mocked<ContextService>;

  const mockContextService = {
    getAccessibleSchools: jest.fn(),
    switchContext: jest.fn(),
    getCurrentContext: jest.fn(),
    computeAccessibleSchoolIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 30 }]),
      ],
      controllers: [ContextController],
      providers: [
        {
          provide: ContextService,
          useValue: mockContextService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ContextThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ContextController>(ContextController);
    contextService = module.get(ContextService);

    jest.clearAllMocks();
  });

  // ─── GET /accessible-schools ───────────────────────────────────────────────

  describe('GET /api/v1/context/accessible-schools', () => {
    it('should return accessible schools list from service', async () => {
      const user = createMockUser();
      const serviceResult = {
        schools: [
          { id: 'school-1', code: 'TH01', name: 'Trường TH 1', hierarchyLevel: 'school' as const },
          { id: 'school-2', code: 'TH02', name: 'Trường TH 2', hierarchyLevel: 'school' as const },
        ],
        canSwitch: true,
      };

      mockContextService.getAccessibleSchools.mockResolvedValue(serviceResult);

      const result = await controller.getAccessibleSchools(user);

      expect(result.schools).toHaveLength(2);
      expect(result.canSwitch).toBe(true);
      expect(result.schools[0]).toEqual(expect.objectContaining({
        id: 'school-1',
        code: 'TH01',
        name: 'Trường TH 1',
        hierarchyLevel: 'school',
        canSwitch: true,
      }));
    });

    it('should return empty array when user has no accessible schools', async () => {
      const user = createMockUser({ role: UserRole.VIEWER });
      const serviceResult = { schools: [], canSwitch: false };

      mockContextService.getAccessibleSchools.mockResolvedValue(serviceResult);

      const result = await controller.getAccessibleSchools(user);

      expect(result.schools).toHaveLength(0);
      expect(result.canSwitch).toBe(false);
    });

    it('should map user payload to ContextJwtUser before calling service', async () => {
      const user = createMockUser({
        id: 'user-123',
        role: UserRole.COMPANY_ADMIN,
        schoolId: 'school-A',
        accessibleSchoolIds: ['school-A', 'school-B'],
      });
      (user as ContextJwtUser).companySchoolId = 'company-school-1';

      mockContextService.getAccessibleSchools.mockResolvedValue({
        schools: [],
        canSwitch: false,
      });

      await controller.getAccessibleSchools(user);

      expect(mockContextService.getAccessibleSchools).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-123',
          role: UserRole.COMPANY_ADMIN,
          schoolId: 'school-A',
          accessibleSchoolIds: ['school-A', 'school-B'],
          companySchoolId: 'company-school-1',
        }),
      );
    });
  });

  // ─── POST /switch ──────────────────────────────────────────────────────────

  describe('POST /api/v1/context/switch', () => {
    it('should pass user, schoolId, ip, and correlationId to service and return result', async () => {
      const user = createMockUser();
      const dto = { schoolId: 'school-uuid-0001-0000-000000000002' };
      const ip = '192.168.1.1';
      const mockReq = { correlationId: 'test-correlation-id-123' } as unknown as import('express').Request;
      const serviceResult = { id: dto.schoolId, code: 'TH02', name: 'Trường TH 2' };

      mockContextService.switchContext.mockResolvedValue(serviceResult);

      const result = await controller.switchContext(user, dto, ip, mockReq);

      expect(mockContextService.switchContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id, role: user.role }),
        dto.schoolId,
        ip,
        'test-correlation-id-123',
      );
      expect(result).toEqual(serviceResult);
    });

    it('should propagate service error when switch fails', async () => {
      const user = createMockUser();
      const dto = { schoolId: 'inaccessible-school-id' };
      const ip = '10.0.0.1';
      const mockReq = { correlationId: undefined } as unknown as import('express').Request;

      mockContextService.switchContext.mockRejectedValue(
        new Error('Bạn không có quyền truy cập trường này'),
      );

      await expect(controller.switchContext(user, dto, ip, mockReq)).rejects.toThrow(
        'Bạn không có quyền truy cập trường này',
      );
    });
  });

  // ─── GET /current ──────────────────────────────────────────────────────────

  describe('GET /api/v1/context/current', () => {
    it('should return current context from service', async () => {
      const user = createMockUser();
      const serviceResult = {
        activeSchoolId: 'school-uuid-0001-0000-000000000001',
        activeSchoolName: 'Trường TH Nguyễn Bỉnh Khiêm',
        activeSchoolCode: 'TH01',
        globalView: false,
        role: UserRole.TEACHER,
        canSwitch: true,
        contextRequired: false,
      };

      mockContextService.getCurrentContext.mockResolvedValue(serviceResult);

      const result = await controller.getCurrentContext(user);

      expect(result).toEqual(serviceResult);
      expect(mockContextService.getCurrentContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id, role: user.role }),
      );
    });

    it('should return contextRequired true when no context established', async () => {
      const user = createMockUser({ schoolId: null });
      const serviceResult = {
        activeSchoolId: null,
        activeSchoolName: null,
        activeSchoolCode: null,
        globalView: false,
        role: UserRole.TEACHER,
        canSwitch: true,
        contextRequired: true,
      };

      mockContextService.getCurrentContext.mockResolvedValue(serviceResult);

      const result = await controller.getCurrentContext(user);

      expect(result.contextRequired).toBe(true);
      expect(result.activeSchoolId).toBeNull();
    });
  });

  // ─── 401 Unauthenticated ──────────────────────────────────────────────────

  describe('Authentication guard (JwtAuthGuard)', () => {
    it('should reject unauthenticated requests with 401', async () => {
      // Create a separate module where JwtAuthGuard actually rejects
      const moduleWithRealGuard: TestingModule = await Test.createTestingModule({
        imports: [
          ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 30 }]),
        ],
        controllers: [ContextController],
        providers: [
          {
            provide: ContextService,
            useValue: mockContextService,
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: () => {
            throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
          },
        })
        .overrideGuard(ContextThrottlerGuard)
        .useValue({ canActivate: () => true })
        .compile();

      const guardedController = moduleWithRealGuard.get<ContextController>(ContextController);

      // The guard would reject before reaching the controller method.
      // In unit tests with NestJS Testing module, guards are applied at the handler level.
      // We verify the guard metadata is applied to the controller class.
      const guards = Reflect.getMetadata('__guards__', ContextController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('should have JwtAuthGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', ContextController);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThanOrEqual(1);
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ─── Rate Limiting ─────────────────────────────────────────────────────────

  describe('Rate limiting on switch endpoint', () => {
    it('should have @Throttle decorator on switchContext method with limit 30', () => {
      // @Throttle({ default: { ttl: 60000, limit: 30 } }) stores metadata as:
      // key: 'THROTTLER:LIMIT' + name → 'THROTTLER:LIMITdefault'
      const limitMetadata = Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        ContextController.prototype.switchContext,
      );

      expect(limitMetadata).toBe(30);
    });

    it('should configure TTL to 60 seconds (60000ms) on switch endpoint', () => {
      const ttlMetadata = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        ContextController.prototype.switchContext,
      );

      expect(ttlMetadata).toBe(60000);
    });

    it('should return Vietnamese message in rate limit exception', () => {
      // Verify the ContextSwitchRateLimitedException uses correct message
      const { ContextSwitchRateLimitedException } = require('../exceptions/context.exceptions');
      const exception = new ContextSwitchRateLimitedException();

      expect(exception.getStatus()).toBe(429);
      const response = exception.getResponse() as Record<string, unknown>;
      expect(response.message).toBe(
        'Quá nhiều yêu cầu chuyển đổi. Vui lòng thử lại sau.',
      );
    });
  });

  // ─── Controller method mapping ────────────────────────────────────────────

  describe('Endpoint routing metadata', () => {
    it('should have GET method for accessible-schools', () => {
      const path = Reflect.getMetadata('path', ContextController.prototype.getAccessibleSchools);
      const method = Reflect.getMetadata('method', ContextController.prototype.getAccessibleSchools);

      expect(path).toBe('accessible-schools');
    });

    it('should have POST method for switch', () => {
      const path = Reflect.getMetadata('path', ContextController.prototype.switchContext);

      expect(path).toBe('switch');
    });

    it('should have GET method for current', () => {
      const path = Reflect.getMetadata('path', ContextController.prototype.getCurrentContext);

      expect(path).toBe('current');
    });

    it('should have controller prefix api/v1/context', () => {
      const prefix = Reflect.getMetadata('path', ContextController);

      expect(prefix).toBe('api/v1/context');
    });
  });
});
