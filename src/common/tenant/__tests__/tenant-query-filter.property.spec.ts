import * as fc from 'fast-check';

import { TenantContextService } from '../tenant-context.service';
import { TenantAuditService } from '../tenant-audit.service';
import { TenantSubscriber } from '../tenant.subscriber';
import { TenantBaseEntity } from '../tenant-base.entity';
import { TenantStore } from '../tenant.interfaces';

/**
 * Feature: multi-tenant-enforcement, Property 3: Automatic query filter on tenant-aware entities
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * For any tenant-aware entity (extending TenantBaseEntity) and any active tenant
 * context with a non-bypass school_id, every SELECT, UPDATE, and DELETE query
 * generated SHALL include a `WHERE school_id = :tenantSchoolId` condition matching
 * the context's school_id.
 */
describe('Feature: multi-tenant-enforcement, Property 3: Automatic query filter on tenant-aware entities', () => {
  let tenantContext: TenantContextService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
  });

  /**
   * Creates a mock SelectQueryBuilder that simulates a tenant-aware entity query.
   * Tracks calls to `andWhere` to verify the tenant filter is applied.
   */
  function createMockQueryBuilder(entityName: string) {
    const andWhereCalls: { condition: string; parameters: Record<string, unknown> }[] = [];

    const mockMetadata = {
      name: entityName,
      target: class extends TenantBaseEntity {
        schoolId: string;
      },
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
   * Creates a TenantSubscriber with a mock DataSource.
   */
  function createSubscriber(context: TenantContextService): TenantSubscriber {
    const mockDataSource = {
      subscribers: [],
    } as unknown as import('typeorm').DataSource;

    const mockAudit = {
      logTenantContextError: jest.fn(),
      logRlsViolation: jest.fn(),
      logImpersonation: jest.fn(),
    } as unknown as TenantAuditService;

    return new TenantSubscriber(mockDataSource, context, mockAudit);
  }

  it('applyTenantFilter appends WHERE school_id = :tenantSchoolId for any random schoolId', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const subscriber = createSubscriber(tenantContext);

        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        tenantContext.run(store, () => {
          const { qb, andWhereCalls } = createMockQueryBuilder('TestEntity');

          subscriber.applyTenantFilter(qb as any, 'entity');

          // Verify andWhere was called exactly once
          expect(andWhereCalls.length).toBe(1);

          // Verify the condition includes school_id with the correct alias
          expect(andWhereCalls[0].condition).toBe(
            'entity.school_id = :tenantSchoolId',
          );

          // Verify the parameter matches the context's schoolId
          expect(andWhereCalls[0].parameters).toEqual({
            tenantSchoolId: schoolId,
          });
        });
      }),
      { numRuns: 100 },
    );
  });

  it('applyTenantFilter uses the exact schoolId from context regardless of entity alias', async () => {
    const aliasArb = fc.string({ minLength: 1, maxLength: 20 }).filter(
      (s) => /^[a-z]+$/.test(s),
    );

    await fc.assert(
      fc.asyncProperty(fc.uuid(), aliasArb, async (schoolId: string, alias: string) => {
        const subscriber = createSubscriber(tenantContext);

        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        tenantContext.run(store, () => {
          const { qb, andWhereCalls } = createMockQueryBuilder('SomeEntity');

          subscriber.applyTenantFilter(qb as any, alias);

          expect(andWhereCalls.length).toBe(1);
          expect(andWhereCalls[0].condition).toBe(
            `${alias}.school_id = :tenantSchoolId`,
          );
          expect(andWhereCalls[0].parameters.tenantSchoolId).toBe(schoolId);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('applyTenantFilter consistently applies filter for any schoolId across multiple calls within same context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 2, max: 5 }),
        async (schoolId, callCount) => {
          const subscriber = createSubscriber(tenantContext);

          const store: TenantStore = {
            schoolId,
            isBypass: false,
            userId: null,
          };

          tenantContext.run(store, () => {
            for (let i = 0; i < callCount; i++) {
              const { qb, andWhereCalls } = createMockQueryBuilder(
                `Entity${i}`,
              );

              subscriber.applyTenantFilter(qb as any, `alias${i}`);

              expect(andWhereCalls.length).toBe(1);
              expect(andWhereCalls[0].parameters.tenantSchoolId).toBe(schoolId);
            }
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
