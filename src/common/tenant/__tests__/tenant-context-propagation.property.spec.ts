import * as fc from 'fast-check';

import { TenantContextService } from '../tenant-context.service';
import { TenantStore } from '../tenant.interfaces';

/**
 * Feature: multi-tenant-enforcement, Property 1: Tenant context propagation
 *
 * **Validates: Requirements 1.1, 1.2, 7.3**
 *
 * For any valid school_id, when code is executed within a
 * `tenantContext.run({ schoolId })` scope, calling `tenantContext.getSchoolId()`
 * from any nested async operation within that scope SHALL return that same school_id.
 */
describe('Feature: multi-tenant-enforcement, Property 1: Tenant context propagation', () => {
  let service: TenantContextService;

  beforeEach(() => {
    service = new TenantContextService();
  });

  it('getSchoolId() returns the same schoolId within a synchronous run() scope for any UUID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        const result = service.run(store, () => {
          return service.getSchoolId();
        });

        expect(result).toBe(schoolId);
      }),
      { numRuns: 100 },
    );
  });

  it('getSchoolId() returns the same schoolId within a nested Promise for any UUID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        const result = await service.run(store, async () => {
          // Simulate nested async operation with Promise
          const nested = await Promise.resolve().then(() => {
            return service.getSchoolId();
          });
          return nested;
        });

        expect(result).toBe(schoolId);
      }),
      { numRuns: 100 },
    );
  });

  it('getSchoolId() returns the same schoolId within a setTimeout-based async operation for any UUID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        const result = await service.run(store, () => {
          return new Promise<string | null | undefined>((resolve) => {
            setTimeout(() => {
              resolve(service.getSchoolId());
            }, 0);
          });
        });

        expect(result).toBe(schoolId);
      }),
      { numRuns: 100 },
    );
  });

  it('getSchoolId() returns the same schoolId through multiple levels of nested async calls for any UUID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (schoolId) => {
        const store: TenantStore = {
          schoolId,
          isBypass: false,
          userId: null,
        };

        const result = await service.run(store, async () => {
          // Level 1: async function
          const level1 = async () => {
            // Level 2: another async function
            const level2 = async () => {
              // Level 3: Promise chain
              return Promise.resolve().then(() => service.getSchoolId());
            };
            return level2();
          };
          return level1();
        });

        expect(result).toBe(schoolId);
      }),
      { numRuns: 100 },
    );
  });
});
