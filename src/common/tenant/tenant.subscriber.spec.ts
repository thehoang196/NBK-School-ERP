import { TenantSubscriber } from './tenant.subscriber';
import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantBaseEntity } from './tenant-base.entity';
import { TenantContextRequiredError } from './exceptions/tenant-context-required.error';
import { BaseEntity } from '../entities/base.entity';
import {
  DataSource,
  EntityMetadata,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  SoftRemoveEvent,
  SelectQueryBuilder,
} from 'typeorm';

// --- Test Entities ---

class TestTenantEntity extends TenantBaseEntity {
  name: string;
}

class TestNonTenantEntity extends BaseEntity {
  title: string;
}

// --- Helpers ---

function createMockDataSource(): DataSource {
  return {
    subscribers: [],
  } as unknown as DataSource;
}

function createMockTenantContext(
  overrides: Partial<{
    isActive: boolean;
    isBypass: boolean;
    schoolId: string | null | undefined;
  }> = {},
): TenantContextService {
  const defaults = {
    isActive: true,
    isBypass: false,
    schoolId: 'school-123',
  };
  const config = { ...defaults, ...overrides };

  return {
    isActive: jest.fn().mockReturnValue(config.isActive),
    isBypass: jest.fn().mockReturnValue(config.isBypass),
    getSchoolId: jest.fn().mockReturnValue(config.schoolId),
    getStore: jest.fn().mockReturnValue(
      config.isActive
        ? { schoolId: config.schoolId, isBypass: config.isBypass, userId: null }
        : undefined,
    ),
    run: jest.fn(),
  } as unknown as TenantContextService;
}

function createMockTenantAudit(): TenantAuditService {
  return {
    logTenantContextError: jest.fn(),
    logRlsViolation: jest.fn(),
    logImpersonation: jest.fn(),
  } as unknown as TenantAuditService;
}

function createTenantEntityMetadata(): EntityMetadata {
  return {
    target: TestTenantEntity,
    name: 'TestTenantEntity',
  } as unknown as EntityMetadata;
}

function createNonTenantEntityMetadata(): EntityMetadata {
  return {
    target: TestNonTenantEntity,
    name: 'TestNonTenantEntity',
  } as unknown as EntityMetadata;
}

describe('TenantSubscriber', () => {
  let subscriber: TenantSubscriber;
  let mockDataSource: DataSource;
  let mockTenantContext: TenantContextService;
  let mockTenantAudit: TenantAuditService;

  beforeEach(() => {
    mockDataSource = createMockDataSource();
    mockTenantContext = createMockTenantContext();
    mockTenantAudit = createMockTenantAudit();
    subscriber = new TenantSubscriber(mockDataSource, mockTenantContext, mockTenantAudit);
  });

  describe('constructor', () => {
    it('should register itself in dataSource.subscribers', () => {
      expect(mockDataSource.subscribers).toContain(subscriber);
    });
  });

  describe('isTenantEntity', () => {
    it('should return true for entities extending TenantBaseEntity', () => {
      const metadata = createTenantEntityMetadata();
      expect(subscriber.isTenantEntity(metadata)).toBe(true);
    });

    it('should return false for entities not extending TenantBaseEntity', () => {
      const metadata = createNonTenantEntityMetadata();
      expect(subscriber.isTenantEntity(metadata)).toBe(false);
    });

    it('should return false for metadata with non-function target', () => {
      const metadata = { target: 'some_table_name', name: 'SomeTable' } as unknown as EntityMetadata;
      expect(subscriber.isTenantEntity(metadata)).toBe(false);
    });
  });

  describe('beforeInsert', () => {
    it('should auto-populate schoolId from context when not explicitly set', () => {
      const entity = new TestTenantEntity();
      entity.schoolId = undefined as unknown as string;

      const event = {
        metadata: createTenantEntityMetadata(),
        entity,
      } as unknown as InsertEvent<TenantBaseEntity>;

      subscriber.beforeInsert(event);

      expect(entity.schoolId).toBe('school-123');
    });

    it('should not overwrite schoolId if already set', () => {
      const entity = new TestTenantEntity();
      entity.schoolId = 'explicit-school-id';

      const event = {
        metadata: createTenantEntityMetadata(),
        entity,
      } as unknown as InsertEvent<TenantBaseEntity>;

      subscriber.beforeInsert(event);

      expect(entity.schoolId).toBe('explicit-school-id');
    });

    it('should skip non-tenant entities', () => {
      const entity = new TestNonTenantEntity();

      const event = {
        metadata: createNonTenantEntityMetadata(),
        entity,
      } as unknown as InsertEvent<TenantBaseEntity>;

      // Should not throw
      expect(() => subscriber.beforeInsert(event)).not.toThrow();
    });

    it('should skip filtering when in bypass mode', () => {
      const bypassContext = createMockTenantContext({ isBypass: true });
      const bypassSubscriber = new TenantSubscriber(
        createMockDataSource(),
        bypassContext,
        createMockTenantAudit(),
      );

      const entity = new TestTenantEntity();
      entity.schoolId = undefined as unknown as string;

      const event = {
        metadata: createTenantEntityMetadata(),
        entity,
      } as unknown as InsertEvent<TenantBaseEntity>;

      bypassSubscriber.beforeInsert(event);

      // schoolId should remain unset in bypass mode
      expect(entity.schoolId).toBeUndefined();
    });

    it('should throw TenantContextRequiredError when no context is active', () => {
      const noContext = createMockTenantContext({ isActive: false, isBypass: false });
      const noContextSubscriber = new TenantSubscriber(
        createMockDataSource(),
        noContext,
        createMockTenantAudit(),
      );

      const entity = new TestTenantEntity();
      const event = {
        metadata: createTenantEntityMetadata(),
        entity,
      } as unknown as InsertEvent<TenantBaseEntity>;

      expect(() => noContextSubscriber.beforeInsert(event)).toThrow(
        TenantContextRequiredError,
      );
    });
  });

  describe('beforeUpdate', () => {
    it('should not throw when tenant context is active', () => {
      const event = {
        metadata: createTenantEntityMetadata(),
        entity: new TestTenantEntity(),
      } as unknown as UpdateEvent<TenantBaseEntity>;

      expect(() => subscriber.beforeUpdate(event)).not.toThrow();
    });

    it('should skip non-tenant entities', () => {
      const event = {
        metadata: createNonTenantEntityMetadata(),
        entity: new TestNonTenantEntity(),
      } as unknown as UpdateEvent<TenantBaseEntity>;

      expect(() => subscriber.beforeUpdate(event)).not.toThrow();
    });

    it('should not throw in bypass mode', () => {
      const bypassContext = createMockTenantContext({ isBypass: true });
      const bypassSubscriber = new TenantSubscriber(
        createMockDataSource(),
        bypassContext,
        createMockTenantAudit(),
      );

      const event = {
        metadata: createTenantEntityMetadata(),
        entity: new TestTenantEntity(),
      } as unknown as UpdateEvent<TenantBaseEntity>;

      expect(() => bypassSubscriber.beforeUpdate(event)).not.toThrow();
    });

    it('should throw TenantContextRequiredError when no context is active', () => {
      const noContext = createMockTenantContext({ isActive: false, isBypass: false });
      const noContextSubscriber = new TenantSubscriber(
        createMockDataSource(),
        noContext,
        createMockTenantAudit(),
      );

      const event = {
        metadata: createTenantEntityMetadata(),
        entity: new TestTenantEntity(),
      } as unknown as UpdateEvent<TenantBaseEntity>;

      expect(() => noContextSubscriber.beforeUpdate(event)).toThrow(
        TenantContextRequiredError,
      );
    });
  });

  describe('beforeRemove', () => {
    it('should not throw when tenant context is active', () => {
      const event = {
        metadata: createTenantEntityMetadata(),
        entity: new TestTenantEntity(),
      } as unknown as RemoveEvent<TenantBaseEntity>;

      expect(() => subscriber.beforeRemove(event)).not.toThrow();
    });

    it('should skip non-tenant entities', () => {
      const event = {
        metadata: createNonTenantEntityMetadata(),
        entity: new TestNonTenantEntity(),
      } as unknown as RemoveEvent<TenantBaseEntity>;

      expect(() => subscriber.beforeRemove(event)).not.toThrow();
    });

    it('should throw TenantContextRequiredError when no context is active', () => {
      const noContext = createMockTenantContext({ isActive: false, isBypass: false });
      const noContextSubscriber = new TenantSubscriber(
        createMockDataSource(),
        noContext,
        createMockTenantAudit(),
      );

      const event = {
        metadata: createTenantEntityMetadata(),
        entity: new TestTenantEntity(),
      } as unknown as RemoveEvent<TenantBaseEntity>;

      expect(() => noContextSubscriber.beforeRemove(event)).toThrow(
        TenantContextRequiredError,
      );
    });
  });

  describe('beforeSoftRemove', () => {
    it('should not throw when tenant context is active', () => {
      const event = {
        metadata: createTenantEntityMetadata(),
        entity: new TestTenantEntity(),
      } as unknown as SoftRemoveEvent<TenantBaseEntity>;

      expect(() => subscriber.beforeSoftRemove(event)).not.toThrow();
    });

    it('should skip non-tenant entities', () => {
      const event = {
        metadata: createNonTenantEntityMetadata(),
        entity: new TestNonTenantEntity(),
      } as unknown as SoftRemoveEvent<TenantBaseEntity>;

      expect(() => subscriber.beforeSoftRemove(event)).not.toThrow();
    });

    it('should throw TenantContextRequiredError when no context is active', () => {
      const noContext = createMockTenantContext({ isActive: false, isBypass: false });
      const noContextSubscriber = new TenantSubscriber(
        createMockDataSource(),
        noContext,
        createMockTenantAudit(),
      );

      const event = {
        metadata: createTenantEntityMetadata(),
        entity: new TestTenantEntity(),
      } as unknown as SoftRemoveEvent<TenantBaseEntity>;

      expect(() => noContextSubscriber.beforeSoftRemove(event)).toThrow(
        TenantContextRequiredError,
      );
    });
  });

  describe('applyTenantFilter', () => {
    let mockQb: SelectQueryBuilder<TestTenantEntity>;

    beforeEach(() => {
      mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        expressionMap: {
          mainAlias: {
            metadata: createTenantEntityMetadata(),
          },
        },
      } as unknown as SelectQueryBuilder<TestTenantEntity>;
    });

    it('should append WHERE school_id condition', () => {
      subscriber.applyTenantFilter(mockQb, 'entity');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'entity.school_id = :tenantSchoolId',
        { tenantSchoolId: 'school-123' },
      );
    });

    it('should not append WHERE condition in bypass mode', () => {
      const bypassContext = createMockTenantContext({ isBypass: true });
      const bypassSubscriber = new TenantSubscriber(
        createMockDataSource(),
        bypassContext,
        createMockTenantAudit(),
      );

      bypassSubscriber.applyTenantFilter(mockQb, 'entity');

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should skip non-tenant entities', () => {
      const nonTenantQb = {
        andWhere: jest.fn().mockReturnThis(),
        expressionMap: {
          mainAlias: {
            metadata: createNonTenantEntityMetadata(),
          },
        },
      } as unknown as SelectQueryBuilder<TestTenantEntity>;

      subscriber.applyTenantFilter(nonTenantQb, 'entity');

      expect(nonTenantQb.andWhere).not.toHaveBeenCalled();
    });

    it('should throw TenantContextRequiredError when no context is active', () => {
      const noContext = createMockTenantContext({ isActive: false, isBypass: false });
      const noContextSubscriber = new TenantSubscriber(
        createMockDataSource(),
        noContext,
        createMockTenantAudit(),
      );

      expect(() => noContextSubscriber.applyTenantFilter(mockQb, 'entity')).toThrow(
        TenantContextRequiredError,
      );
    });
  });

  describe('getTenantSchoolId', () => {
    it('should return schoolId when context is active', () => {
      const result = subscriber.getTenantSchoolId('TestEntity');
      expect(result).toBe('school-123');
    });

    it('should return null in bypass mode', () => {
      const bypassContext = createMockTenantContext({ isBypass: true });
      const bypassSubscriber = new TenantSubscriber(
        createMockDataSource(),
        bypassContext,
        createMockTenantAudit(),
      );

      const result = bypassSubscriber.getTenantSchoolId('TestEntity');
      expect(result).toBeNull();
    });

    it('should throw TenantContextRequiredError when no context', () => {
      const noContext = createMockTenantContext({ isActive: false, isBypass: false });
      const noContextSubscriber = new TenantSubscriber(
        createMockDataSource(),
        noContext,
        createMockTenantAudit(),
      );

      expect(() => noContextSubscriber.getTenantSchoolId('TestEntity')).toThrow(
        TenantContextRequiredError,
      );
    });
  });
});
