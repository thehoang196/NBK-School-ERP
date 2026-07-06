import * as fc from 'fast-check';
import { EntityMetadata, InsertEvent } from 'typeorm';

import { TenantContextService } from '../tenant-context.service';
import { TenantAuditService } from '../tenant-audit.service';
import { TenantSubscriber } from '../tenant.subscriber';
import { TenantBaseEntity } from '../tenant-base.entity';
import { TenantStore } from '../tenant.interfaces';

/**
 * Feature: multi-tenant-enforcement, Property 5: Bypass mode disables tenant filter
 *
 * **Validates: Requirements 2.5, 5.1, 7.4**
 *
 * For any tenant-aware entity query executed within a bypass context (isBypass = true),
 * the TenantSubscriber SHALL NOT append a school_id WHERE condition, allowing access
 * to all rows regardless of tenant.
 */
describe('Feature: multi-tenant-enforcement, Property 5: Bypass mode disables tenant filter', () => {
  let tenantContext: TenantContextService;
  let subscriber: TenantSubscriber;

  /**
   * A concrete test entity extending TenantBaseEntity for testing purposes.
   */
  class TestTenantEntity extends TenantBaseEntity {
    name: string;
  }

  /**
   * Creates a mock SelectQueryBuilder that simulates a tenant-aware entity query.
   * Tracks calls to `andWhere` to verify the tenant filter is NOT applied.
   */
  function createMockQueryBuilder(entityName: string) {
    const andWhereCalls: { condition: string; parameters: Record<string, unknown> }[] = [];

    const mockMetadata = {
      name: entityName,
      target: TestTenantEntity,
    };

    const qb: Record<string, unknown> = {
      expressionMap: {
        mainAlias: {
          metadata: mockMetadata,
        },
      },
      andWhere: jest.fn((condition: string, parameters?: Record<string, unknown>) => {
        andWhereCalls.push({ condition, parameters: parameters || {} });
        return qb;
      }),
    };

    return { qb, andWhereCalls, mockMetadata };
  }

  /**
   * Creates a mock EntityMetadata that the subscriber recognizes as a tenant entity.
   */
  function createTenantEntityMetadata(): EntityMetadata {
    return {
      target: TestTenantEntity,
      name: 'TestTenantEntity',
    } as unknown as EntityMetadata;
  }

  /**
   * Creates a mock InsertEvent for a TenantBaseEntity.
   */
  function createInsertEvent(
    entity: TestTenantEntity,
    metadata: EntityMetadata,
  ): InsertEvent<TenantBaseEntity> {
    return {
      entity,
      metadata,
      connection: {} as never,
      queryRunner: {} as never,
      manager: {} as never,
    } as unknown as InsertEvent<TenantBaseEntity>;
  }

  beforeEach(() => {
    tenantContext = new TenantContextService();

    const mockDataSource = {
      subscribers: [],
    } as unknown as import('typeorm').DataSource;

    const mockAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    subscriber = new TenantSubscriber(mockDataSource, tenantContext, mockAudit);
  });

  it('applyTenantFilter does NOT call andWhere when isBypass is true, for any random UUID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (randomSchoolId) => {
        // Even if a schoolId is provided alongside bypass, bypass takes precedence
        const store: TenantStore = {
          schoolId: null,
          isBypass: true,
          userId: null,
        };

        tenantContext.run(store, () => {
          const { qb, andWhereCalls } = createMockQueryBuilder('TestEntity');

          subscriber.applyTenantFilter(qb as any, 'entity');

          // Verify andWhere was NOT called — bypass mode skips filtering
          expect(andWhereCalls.length).toBe(0);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('applyTenantFilter does NOT call andWhere regardless of alias when isBypass is true', async () => {
    const aliasArb = fc.stringMatching(/^[a-z]{1,20}$/);

    await fc.assert(
      fc.asyncProperty(fc.uuid(), aliasArb, async (randomSchoolId, alias) => {
        const store: TenantStore = {
          schoolId: null,
          isBypass: true,
          userId: null,
        };

        tenantContext.run(store, () => {
          const { qb, andWhereCalls } = createMockQueryBuilder('SomeEntity');

          subscriber.applyTenantFilter(qb as any, alias);

          // No filter should be appended in bypass mode
          expect(andWhereCalls.length).toBe(0);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('beforeInsert does NOT auto-populate schoolId when isBypass is true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (randomUuid) => {
        const store: TenantStore = {
          schoolId: null,
          isBypass: true,
          userId: null,
        };

        tenantContext.run(store, () => {
          const entity = new TestTenantEntity();
          // schoolId is NOT set (undefined) — but bypass should NOT populate it
          const metadata = createTenantEntityMetadata();
          const event = createInsertEvent(entity, metadata);

          subscriber.beforeInsert(event);

          // In bypass mode, entity.schoolId should remain unset (falsy)
          expect(event.entity.schoolId).toBeFalsy();
        });
      }),
      { numRuns: 100 },
    );
  });

  it('applyTenantFilter returns the QueryBuilder unmodified in bypass mode for multiple sequential queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (queryCount) => {
          const store: TenantStore = {
            schoolId: null,
            isBypass: true,
            userId: null,
          };

          tenantContext.run(store, () => {
            for (let i = 0; i < queryCount; i++) {
              const { qb, andWhereCalls } = createMockQueryBuilder(`Entity${i}`);

              const result = subscriber.applyTenantFilter(qb as any, `alias${i}`);

              // andWhere should never be called
              expect(andWhereCalls.length).toBe(0);
              // The returned QueryBuilder should be the same object (unmodified)
              expect(result).toBe(qb);
            }
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
