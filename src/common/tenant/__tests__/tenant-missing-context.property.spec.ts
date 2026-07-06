import * as fc from 'fast-check';

import { TenantContextService } from '../tenant-context.service';
import { TenantAuditService } from '../tenant-audit.service';
import { TenantSubscriber } from '../tenant.subscriber';
import { TenantBaseEntity } from '../tenant-base.entity';
import { TenantContextRequiredError } from '../exceptions/tenant-context-required.error';
import { EntityMetadata } from 'typeorm';

/**
 * Feature: multi-tenant-enforcement, Property 6: Missing context throws TenantContextRequiredError
 *
 * **Validates: Requirements 2.6, 7.5**
 *
 * For any query (SELECT, INSERT, UPDATE, DELETE) on a tenant-aware entity
 * when no TenantScopeContext is active (neither school_id nor bypass token),
 * the TenantSubscriber SHALL throw a TenantContextRequiredError before the query executes.
 */
describe('Feature: multi-tenant-enforcement, Property 6: Missing context throws TenantContextRequiredError', () => {
  let tenantContext: TenantContextService;
  let subscriber: TenantSubscriber;

  /**
   * Creates a mock EntityMetadata that simulates a tenant-aware entity
   * (one that extends TenantBaseEntity).
   */
  function createTenantEntityMetadata(entityName: string): EntityMetadata {
    // Create a class that extends TenantBaseEntity to simulate a real tenant entity
    class MockTenantEntity extends TenantBaseEntity {
      schoolId: string;
    }

    return {
      name: entityName,
      target: MockTenantEntity,
    } as unknown as EntityMetadata;
  }

  beforeEach(() => {
    // Create a real TenantContextService (NOT inside any run() scope)
    tenantContext = new TenantContextService();

    // Create TenantSubscriber with a mock DataSource
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

  it('beforeInsert throws TenantContextRequiredError when no context is active for any entity name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (entityName) => {
          const metadata = createTenantEntityMetadata(entityName);

          const mockEntity = { schoolId: undefined } as any;
          const event = {
            metadata,
            entity: mockEntity,
          } as any;

          expect(() => subscriber.beforeInsert(event)).toThrow(
            TenantContextRequiredError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('beforeUpdate throws TenantContextRequiredError when no context is active for any entity name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (entityName) => {
          const metadata = createTenantEntityMetadata(entityName);

          const event = {
            metadata,
            entity: { schoolId: 'some-id' },
          } as any;

          expect(() => subscriber.beforeUpdate(event)).toThrow(
            TenantContextRequiredError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('beforeRemove throws TenantContextRequiredError when no context is active for any entity name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (entityName) => {
          const metadata = createTenantEntityMetadata(entityName);

          const event = {
            metadata,
            entity: { schoolId: 'some-id' },
          } as any;

          expect(() => subscriber.beforeRemove(event)).toThrow(
            TenantContextRequiredError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('beforeSoftRemove throws TenantContextRequiredError when no context is active for any entity name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (entityName) => {
          const metadata = createTenantEntityMetadata(entityName);

          const event = {
            metadata,
            entity: { schoolId: 'some-id' },
          } as any;

          expect(() => subscriber.beforeSoftRemove(event)).toThrow(
            TenantContextRequiredError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('applyTenantFilter throws TenantContextRequiredError when no context is active for any entity name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (entityName) => {
          // Create a class that extends TenantBaseEntity
          class MockTenantEntity extends TenantBaseEntity {
            schoolId: string;
          }

          const metadata = {
            name: entityName,
            target: MockTenantEntity,
          } as unknown as EntityMetadata;

          // Mock a SelectQueryBuilder with the tenant entity metadata
          const mockQb = {
            expressionMap: {
              mainAlias: {
                metadata,
              },
            },
            andWhere: jest.fn().mockReturnThis(),
          } as any;

          expect(() => subscriber.applyTenantFilter(mockQb, 'entity')).toThrow(
            TenantContextRequiredError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('thrown TenantContextRequiredError contains the entity name in message for any entity name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (entityName) => {
          const metadata = createTenantEntityMetadata(entityName);

          const event = {
            metadata,
            entity: { schoolId: 'some-id' },
          } as any;

          try {
            subscriber.beforeUpdate(event);
            // Should not reach here
            fail('Expected TenantContextRequiredError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(TenantContextRequiredError);
            const response = (error as TenantContextRequiredError).getResponse() as any;
            expect(response.message).toContain(entityName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
