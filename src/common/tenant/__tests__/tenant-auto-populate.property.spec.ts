import * as fc from 'fast-check';
import { EntityMetadata, InsertEvent } from 'typeorm';

import { TenantContextService } from '../tenant-context.service';
import { TenantAuditService } from '../tenant-audit.service';
import { TenantSubscriber } from '../tenant.subscriber';
import { TenantBaseEntity } from '../tenant-base.entity';
import { TenantStore } from '../tenant.interfaces';

/**
 * Feature: multi-tenant-enforcement, Property 4: Auto-populate school_id on INSERT
 *
 * **Validates: Requirements 2.4**
 *
 * For any tenant-aware entity that is inserted without an explicitly set school_id,
 * the TenantSubscriber SHALL populate the entity's school_id from the active
 * TenantScopeContext before the INSERT executes.
 */
describe('Feature: multi-tenant-enforcement, Property 4: Auto-populate school_id on INSERT', () => {
  let tenantContext: TenantContextService;
  let subscriber: TenantSubscriber;

  /**
   * A concrete test entity extending TenantBaseEntity for testing purposes.
   */
  class TestTenantEntity extends TenantBaseEntity {
    name: string;
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

    // Create subscriber with a mock DataSource (subscribers array is managed manually)
    const mockDataSource = {
      subscribers: [],
    } as never;

    const mockAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    subscriber = new TenantSubscriber(mockDataSource, tenantContext, mockAudit);
  });

  it('should auto-populate schoolId from context when entity has no schoolId set', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        tenantContext.run(store, () => {
          const entity = new TestTenantEntity();
          // schoolId is NOT set (undefined)
          const metadata = createTenantEntityMetadata();
          const event = createInsertEvent(entity, metadata);

          subscriber.beforeInsert(event);

          expect(event.entity.schoolId).toBe(schoolId);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('should auto-populate schoolId from context when entity schoolId is empty string', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        tenantContext.run(store, () => {
          const entity = new TestTenantEntity();
          entity.schoolId = ''; // Empty string is falsy, should be populated
          const metadata = createTenantEntityMetadata();
          const event = createInsertEvent(entity, metadata);

          subscriber.beforeInsert(event);

          expect(event.entity.schoolId).toBe(schoolId);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('should NOT overwrite schoolId when entity already has an explicit schoolId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (contextSchoolId, entitySchoolId) => {
          // Ensure they differ so we can verify the entity value is preserved
          fc.pre(contextSchoolId !== entitySchoolId);

          const store: TenantStore = {
            schoolId: contextSchoolId,
            isBypass: false,
            userId: null,
          };

          tenantContext.run(store, () => {
            const entity = new TestTenantEntity();
            entity.schoolId = entitySchoolId; // Explicitly set
            const metadata = createTenantEntityMetadata();
            const event = createInsertEvent(entity, metadata);

            subscriber.beforeInsert(event);

            // Should preserve the explicitly set value
            expect(event.entity.schoolId).toBe(entitySchoolId);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should populate schoolId consistently regardless of which UUID is in context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        async (schoolIds) => {
          for (const schoolId of schoolIds) {
            const store: TenantStore = {
              schoolId,
              isBypass: false,
              userId: null,
            };

            tenantContext.run(store, () => {
              const entity = new TestTenantEntity();
              const metadata = createTenantEntityMetadata();
              const event = createInsertEvent(entity, metadata);

              subscriber.beforeInsert(event);

              expect(event.entity.schoolId).toBe(schoolId);
            });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
