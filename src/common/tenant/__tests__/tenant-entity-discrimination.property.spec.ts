import * as fc from 'fast-check';

import { TenantContextService } from '../tenant-context.service';
import { TenantAuditService } from '../tenant-audit.service';
import { TenantSubscriber } from '../tenant.subscriber';
import { TenantBaseEntity } from '../tenant-base.entity';
import { BaseEntity } from '../../entities/base.entity';
import { TenantStore } from '../tenant.interfaces';

/**
 * Feature: multi-tenant-enforcement, Property 7: Entity type discrimination
 *
 * **Validates: Requirements 3.5**
 *
 * For any entity that does NOT extend TenantBaseEntity, the TenantSubscriber
 * SHALL NOT intercept or modify its queries, allowing them to execute without
 * any school_id filtering regardless of the active tenant context.
 */
describe('Feature: multi-tenant-enforcement, Property 7: Entity type discrimination', () => {
  let tenantContext: TenantContextService;
  let subscriber: TenantSubscriber;

  // A non-tenant entity (extends BaseEntity but NOT TenantBaseEntity)
  class NonTenantEntity extends BaseEntity {
    name: string;
  }

  // A tenant entity (extends TenantBaseEntity)
  class TenantEntity extends TenantBaseEntity {
    title: string;
  }

  // A plain class that doesn't extend any base entity
  class PlainEntity {
    id: string;
    data: string;
  }

  beforeEach(() => {
    tenantContext = new TenantContextService();

    // Create a mock DataSource with subscribers array
    const mockDataSource = {
      subscribers: [],
    } as any;

    const mockAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    subscriber = new TenantSubscriber(mockDataSource, tenantContext, mockAudit);
  });

  /**
   * Helper to create mock EntityMetadata with a given target class
   */
  function createMockMetadata(target: Function): any {
    return {
      target,
      name: target.name,
      columns: [],
      relations: [],
    };
  }

  it('isTenantEntity returns false for entities NOT extending TenantBaseEntity', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (usePlainClass) => {
        // Pick between NonTenantEntity (extends BaseEntity) and PlainEntity (plain class)
        const nonTenantTarget = usePlainClass ? PlainEntity : NonTenantEntity;
        const metadata = createMockMetadata(nonTenantTarget);

        const result = subscriber.isTenantEntity(metadata);

        expect(result).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('isTenantEntity returns true for entities extending TenantBaseEntity', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (_schoolId) => {
        const metadata = createMockMetadata(TenantEntity);

        const result = subscriber.isTenantEntity(metadata);

        expect(result).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('beforeInsert does not modify non-tenant entities regardless of tenant context', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        await tenantContext.run(store, async () => {
          const metadata = createMockMetadata(NonTenantEntity);
          const entity = new NonTenantEntity();

          const mockEvent = {
            metadata,
            entity,
          } as any;

          // Should not throw and should not modify entity
          expect(() => subscriber.beforeInsert(mockEvent)).not.toThrow();
          // NonTenantEntity should NOT have schoolId populated
          expect((entity as any).schoolId).toBeUndefined();
        });
      }),
      { numRuns: 100 },
    );
  });

  it('beforeInsert does not modify plain class entities regardless of tenant context', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        await tenantContext.run(store, async () => {
          const metadata = createMockMetadata(PlainEntity);
          const entity = new PlainEntity();

          const mockEvent = {
            metadata,
            entity,
          } as any;

          // Should not throw and should not modify entity
          expect(() => subscriber.beforeInsert(mockEvent)).not.toThrow();
          expect((entity as any).schoolId).toBeUndefined();
        });
      }),
      { numRuns: 100 },
    );
  });

  it('applyTenantFilter does not call andWhere for non-tenant entity queries', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        await tenantContext.run(store, async () => {
          const metadata = createMockMetadata(NonTenantEntity);
          const andWhereMock = jest.fn();

          const mockQb = {
            expressionMap: {
              mainAlias: {
                metadata,
              },
            },
            andWhere: andWhereMock,
          } as any;

          const result = subscriber.applyTenantFilter(mockQb, 'entity');

          // andWhere should NOT be called for non-tenant entities
          expect(andWhereMock).not.toHaveBeenCalled();
          // Should return the same query builder unchanged
          expect(result).toBe(mockQb);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('correctly discriminates between tenant and non-tenant entities in mixed scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.uuid(), async (isTenantType, schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        await tenantContext.run(store, async () => {
          const target = isTenantType ? TenantEntity : NonTenantEntity;
          const metadata = createMockMetadata(target);

          const result = subscriber.isTenantEntity(metadata);

          if (isTenantType) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        });
      }),
      { numRuns: 100 },
    );
  });
});
