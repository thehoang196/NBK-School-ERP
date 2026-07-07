import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: (str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },
}));

import { WorkspaceChangedEvent } from './workspace-changed.event';
import {
  WorkspaceChangedCacheSubscriber,
  WorkspaceChangedAuditSubscriber,
  WorkspaceChangedAnalyticsSubscriber,
  WorkspaceChangedRealtimeSubscriber,
} from './workspace-changed.subscriber';
import { CacheService } from '../../cache/cache.service';
import { AccessibleSchoolsCacheService } from '../services/accessible-schools-cache.service';
import { ContextService, ContextJwtUser } from '../services/context.service';
import { ContextSessionService } from '../services/context-session.service';
import { SchoolRepository } from '../../school/school.repository';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { HierarchyService } from '../../school/services/hierarchy.service';
import { SchoolEntity } from '../../school/entities/school.entity';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import {
  ContextForbiddenException,
  SchoolInactiveException,
} from '../exceptions/context.exceptions';

// ─── Test Factories ────────────────────────────────────────────────────────────

const createMockEvent = (
  overrides: Partial<WorkspaceChangedEvent> = {},
): WorkspaceChangedEvent => {
  const hasExplicitPrevious = 'previousSchoolId' in overrides;
  return new WorkspaceChangedEvent(
    overrides.userId ?? 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    hasExplicitPrevious
      ? (overrides.previousSchoolId as string | null)
      : 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    overrides.newSchoolId ?? 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
    overrides.switchedAt ?? new Date('2025-01-15T10:00:00Z'),
    overrides.correlationId ?? 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  );
};

const createMockSchool = (
  overrides: Partial<SchoolEntity> = {},
): SchoolEntity =>
  ({
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    code: 'TH01',
    name: 'Trường TH Nguyễn Bỉnh Khiêm 1',
    address: null,
    phone: null,
    email: null,
    principalName: null,
    parentSchoolId: null,
    parentSchool: null,
    childSchools: [],
    status: SchoolStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  }) as SchoolEntity;

const createMockUser = (
  overrides: Partial<ContextJwtUser> = {},
): ContextJwtUser => ({
  id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  email: 'test@nbk.edu.vn',
  role: UserRole.SUPER_ADMIN,
  schoolId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  accessibleSchoolIds: [
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  ],
  companySchoolId: null,
  ...overrides,
});

// ─── WorkspaceChangedEvent Unit Tests ──────────────────────────────────────────

describe('WorkspaceChangedEvent', () => {
  it('should create event with correct payload fields', () => {
    const event = new WorkspaceChangedEvent(
      'user-123',
      'prev-school-456',
      'new-school-789',
      new Date('2025-01-15T10:00:00Z'),
      'corr-id-abc',
    );

    expect(event.userId).toBe('user-123');
    expect(event.previousSchoolId).toBe('prev-school-456');
    expect(event.newSchoolId).toBe('new-school-789');
    expect(event.switchedAt).toEqual(new Date('2025-01-15T10:00:00Z'));
    expect(event.correlationId).toBe('corr-id-abc');
  });

  it('should allow null previousSchoolId for first switch', () => {
    const event = new WorkspaceChangedEvent(
      'user-123',
      null,
      'new-school-789',
      new Date(),
      'corr-id-abc',
    );

    expect(event.previousSchoolId).toBeNull();
  });

  it('should have static eventName property', () => {
    expect(WorkspaceChangedEvent.eventName).toBe('workspace.changed');
  });
});

// ─── Event Emission Integration Tests (ContextService) ─────────────────────────

describe('WorkspaceChangedEvent - Emission via ContextService', () => {
  let service: ContextService;
  let mockEventEmitter: { emit: jest.Mock };
  let schoolRepository: { findById: jest.Mock };
  let contextSessionService: {
    setActiveContext: jest.Mock;
    getActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
  };

  beforeEach(async () => {
    schoolRepository = {
      findById: jest.fn(),
    };

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const mockSchoolEntityRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    contextSessionService = {
      setActiveContext: jest.fn().mockResolvedValue(undefined),
      getActiveContext: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
    };

    const mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockHierarchyService = {
      getDescendants: jest.fn().mockResolvedValue([]),
      getAncestors: jest.fn().mockResolvedValue([]),
      resolveHierarchy: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        { provide: SchoolRepository, useValue: schoolRepository },
        {
          provide: getRepositoryToken(SchoolEntity),
          useValue: mockSchoolEntityRepository,
        },
        {
          provide: TeacherSchoolAssignmentService,
          useValue: { getAccessibleSchoolIds: jest.fn().mockResolvedValue([]) },
        },
        { provide: ContextSessionService, useValue: contextSessionService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: HierarchyService, useValue: mockHierarchyService },
      ],
    }).compile();

    service = module.get<ContextService>(ContextService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Event emitted after successful switch', () => {
    const targetSchoolId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
    const targetSchool = createMockSchool({
      id: targetSchoolId,
      code: 'TH02',
      name: 'Trường TH 2',
    });
    const user = createMockUser({
      role: UserRole.SUPER_ADMIN,
    });

    beforeEach(() => {
      // SUPER_ADMIN gets all active schools
      const mockSchoolEntityRepo = {
        find: jest.fn().mockResolvedValue([
          createMockSchool(),
          targetSchool,
        ]),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      };
      // Override find method on the entity repository
      (service as any).schoolEntityRepository = mockSchoolEntityRepo;
      schoolRepository.findById.mockResolvedValue(targetSchool);
    });

    it('should emit WorkspaceChangedEvent after successful context switch', async () => {
      await service.switchContext(user, targetSchoolId, '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'workspace.changed',
        expect.objectContaining({
          userId: user.id,
          newSchoolId: targetSchoolId,
          previousSchoolId: null,
        }),
      );
    });

    it('should include previousSchoolId from session in emitted event', async () => {
      const previousId = 'school-uuid-prev-0000-000000000099';
      contextSessionService.getActiveContext.mockResolvedValue(previousId);

      await service.switchContext(user, targetSchoolId, '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'workspace.changed',
        expect.objectContaining({
          previousSchoolId: previousId,
          newSchoolId: targetSchoolId,
        }),
      );
    });

    it('should include correlationId in emitted event', async () => {
      const correlationId = 'custom-correlation-id-123';

      await service.switchContext(
        user,
        targetSchoolId,
        '127.0.0.1',
        correlationId,
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'workspace.changed',
        expect.objectContaining({
          correlationId: 'custom-correlation-id-123',
        }),
      );
    });

    it('should include switchedAt timestamp in emitted event', async () => {
      await service.switchContext(user, targetSchoolId, '127.0.0.1');

      const emittedEvent = mockEventEmitter.emit.mock.calls[0][1];
      expect(emittedEvent.switchedAt).toBeInstanceOf(Date);
    });
  });

  describe('Event NOT emitted on failed switch', () => {
    const user = createMockUser({ role: UserRole.SUPER_ADMIN });
    const accessibleSchoolId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    beforeEach(() => {
      const accessibleSchool = createMockSchool({ id: accessibleSchoolId });
      const mockSchoolEntityRepo = {
        find: jest.fn().mockResolvedValue([accessibleSchool]),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      };
      (service as any).schoolEntityRepository = mockSchoolEntityRepo;
    });

    it('should NOT emit event when schoolId format is invalid', async () => {
      await expect(
        service.switchContext(user, 'not-a-valid-uuid', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should NOT emit event when school is not in accessible list', async () => {
      const inaccessibleSchoolId = 'b1ffcd00-1111-4aaa-9999-aaaaaaaaaaaa';

      await expect(
        service.switchContext(user, inaccessibleSchoolId, '127.0.0.1'),
      ).rejects.toThrow(ContextForbiddenException);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should NOT emit event when school is inactive', async () => {
      const inactiveSchool = createMockSchool({
        id: accessibleSchoolId,
        status: SchoolStatus.INACTIVE,
      });
      schoolRepository.findById.mockResolvedValue(inactiveSchool);

      await expect(
        service.switchContext(user, accessibleSchoolId, '127.0.0.1'),
      ).rejects.toThrow(SchoolInactiveException);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('Subscriber failure does not affect switch result', () => {
    const targetSchoolId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
    const targetSchool = createMockSchool({
      id: targetSchoolId,
      code: 'TH02',
      name: 'Trường TH 2',
    });
    const user = createMockUser({ role: UserRole.SUPER_ADMIN });

    beforeEach(() => {
      const mockSchoolEntityRepo = {
        find: jest.fn().mockResolvedValue([
          createMockSchool(),
          targetSchool,
        ]),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      };
      (service as any).schoolEntityRepository = mockSchoolEntityRepo;
      schoolRepository.findById.mockResolvedValue(targetSchool);
    });

    it('should still return success even if eventEmitter.emit throws', async () => {
      mockEventEmitter.emit.mockImplementation(() => {
        throw new Error('Event bus failure');
      });

      const result = await service.switchContext(
        user,
        targetSchoolId,
        '127.0.0.1',
      );

      expect(result).toEqual({
        id: targetSchoolId,
        code: 'TH02',
        name: 'Trường TH 2',
      });
    });
  });
});

// ─── Subscriber Unit Tests ─────────────────────────────────────────────────────

describe('WorkspaceChangedCacheSubscriber', () => {
  let subscriber: WorkspaceChangedCacheSubscriber;
  let mockCacheService: { del: jest.Mock; get: jest.Mock; set: jest.Mock };
  let mockAccessibleSchoolsCacheService: { invalidateForUser: jest.Mock };

  beforeEach(() => {
    mockCacheService = {
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    mockAccessibleSchoolsCacheService = {
      invalidateForUser: jest.fn().mockResolvedValue(undefined),
    };

    subscriber = new WorkspaceChangedCacheSubscriber(
      mockCacheService as unknown as CacheService,
      mockAccessibleSchoolsCacheService as unknown as AccessibleSchoolsCacheService,
    );

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call accessibleSchoolsCacheService.invalidateForUser', async () => {
    const event = createMockEvent();

    await subscriber.handleCacheInvalidation(event);

    expect(mockAccessibleSchoolsCacheService.invalidateForUser).toHaveBeenCalledWith(
      event.userId,
    );
  });

  it('should call cacheService.del with previous school user-specific key', async () => {
    const prevId = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
    const event = createMockEvent({
      previousSchoolId: prevId,
    });

    await subscriber.handleCacheInvalidation(event);

    expect(mockCacheService.del).toHaveBeenCalledWith(
      `context:user-school:${event.userId}:${prevId}`,
    );
  });

  it('should not attempt to delete previous school cache when previousSchoolId is null', async () => {
    const event = createMockEvent({ previousSchoolId: null });

    await subscriber.handleCacheInvalidation(event);

    // Should call invalidateForUser but NOT cacheService.del (since no previousSchoolId)
    expect(mockAccessibleSchoolsCacheService.invalidateForUser).toHaveBeenCalledWith(
      event.userId,
    );
    expect(mockCacheService.del).not.toHaveBeenCalled();
  });

  it('should NOT throw when cacheService.del fails', async () => {
    mockAccessibleSchoolsCacheService.invalidateForUser.mockRejectedValue(
      new Error('Redis connection failed'),
    );
    const event = createMockEvent();

    await expect(
      subscriber.handleCacheInvalidation(event),
    ).resolves.toBeUndefined();
  });
});

// ─── WorkspaceChangedAuditSubscriber ───────────────────────────────────────────

describe('WorkspaceChangedAuditSubscriber', () => {
  let subscriber: WorkspaceChangedAuditSubscriber;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    subscriber = new WorkspaceChangedAuditSubscriber();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log structured audit data on event', async () => {
    const event = createMockEvent();

    await subscriber.handleAuditLog(event);

    expect(logSpy).toHaveBeenCalledWith(
      'Workspace context changed',
      expect.objectContaining({
        userId: event.userId,
        previousSchoolId: event.previousSchoolId,
        newSchoolId: event.newSchoolId,
        switchedAt: event.switchedAt.toISOString(),
        correlationId: event.correlationId,
        eventName: 'workspace.changed',
      }),
    );
  });

  it('should NOT throw when internal logging fails', async () => {
    logSpy.mockImplementation(() => {
      throw new Error('Logger failure');
    });
    const event = createMockEvent();

    await expect(
      subscriber.handleAuditLog(event),
    ).resolves.toBeUndefined();
  });
});

// ─── WorkspaceChangedAnalyticsSubscriber ───────────────────────────────────────

describe('WorkspaceChangedAnalyticsSubscriber', () => {
  let subscriber: WorkspaceChangedAnalyticsSubscriber;

  beforeEach(() => {
    subscriber = new WorkspaceChangedAnalyticsSubscriber();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle event without throwing', async () => {
    const event = createMockEvent();

    await expect(
      subscriber.handleAnalyticsTracking(event),
    ).resolves.toBeUndefined();
  });

  it('should NOT throw when internal operation fails', async () => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {
      throw new Error('Analytics service unavailable');
    });
    const event = createMockEvent();

    await expect(
      subscriber.handleAnalyticsTracking(event),
    ).resolves.toBeUndefined();
  });
});

// ─── WorkspaceChangedRealtimeSubscriber ────────────────────────────────────────

describe('WorkspaceChangedRealtimeSubscriber', () => {
  let subscriber: WorkspaceChangedRealtimeSubscriber;

  beforeEach(() => {
    subscriber = new WorkspaceChangedRealtimeSubscriber();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle event without throwing', async () => {
    const event = createMockEvent();

    await expect(
      subscriber.handleRealtimeUpdate(event),
    ).resolves.toBeUndefined();
  });

  it('should NOT throw when internal operation fails', async () => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {
      throw new Error('WebSocket connection failed');
    });
    const event = createMockEvent();

    await expect(
      subscriber.handleRealtimeUpdate(event),
    ).resolves.toBeUndefined();
  });
});
