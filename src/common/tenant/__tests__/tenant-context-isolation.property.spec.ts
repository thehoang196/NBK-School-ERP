/**
 * Feature: multi-tenant-enforcement, Property 2: Tenant context isolation between concurrent scopes
 *
 * **Validates: Requirements 1.3, 1.4**
 *
 * For any two distinct school_ids running concurrently in separate
 * `tenantContext.run()` scopes, each scope SHALL only observe its own
 * school_id and never the other's, and after the scope exits,
 * `getStore()` SHALL return undefined.
 */
import * as fc from 'fast-check';
import { TenantContextService } from '../tenant-context.service';

describe('Feature: multi-tenant-enforcement, Property 2: Tenant context isolation between concurrent scopes', () => {
  let tenantContext: TenantContextService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * For any two distinct UUIDs running concurrently in separate run() scopes
   * with a small async delay, each scope SHALL only observe its own schoolId.
   */
  it('each concurrent scope SHALL only observe its own schoolId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (schoolIdA, schoolIdB) => {
          // Ensure we have two distinct school IDs
          fc.pre(schoolIdA !== schoolIdB);

          const results = await Promise.all([
            tenantContext.run(
              { schoolId: schoolIdA, isBypass: false, userId: null },
              async () => {
                // Simulate async work with a small delay
                await new Promise((resolve) => setTimeout(resolve, 1));
                const observed = tenantContext.getSchoolId();
                return observed;
              },
            ),
            tenantContext.run(
              { schoolId: schoolIdB, isBypass: false, userId: null },
              async () => {
                // Simulate async work with a small delay
                await new Promise((resolve) => setTimeout(resolve, 1));
                const observed = tenantContext.getSchoolId();
                return observed;
              },
            ),
          ]);

          // Scope A must observe schoolIdA
          expect(results[0]).toBe(schoolIdA);
          // Scope B must observe schoolIdB
          expect(results[1]).toBe(schoolIdB);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * After both concurrent scopes exit, getStore() SHALL return undefined
   * indicating no tenant context is active.
   */
  it('getStore() SHALL return undefined after concurrent scopes exit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (schoolIdA, schoolIdB) => {
          fc.pre(schoolIdA !== schoolIdB);

          await Promise.all([
            tenantContext.run(
              { schoolId: schoolIdA, isBypass: false, userId: null },
              async () => {
                await new Promise((resolve) => setTimeout(resolve, 1));
                return tenantContext.getSchoolId();
              },
            ),
            tenantContext.run(
              { schoolId: schoolIdB, isBypass: false, userId: null },
              async () => {
                await new Promise((resolve) => setTimeout(resolve, 1));
                return tenantContext.getSchoolId();
              },
            ),
          ]);

          // After both scopes exit, store should be undefined
          expect(tenantContext.getStore()).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * For any pair of distinct UUIDs running concurrently with multiple
   * interleaved async checkpoints, each scope SHALL consistently observe
   * only its own schoolId at every checkpoint.
   */
  it('each scope SHALL consistently observe its own schoolId across multiple async checkpoints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (schoolIdA, schoolIdB) => {
          fc.pre(schoolIdA !== schoolIdB);

          const results = await Promise.all([
            tenantContext.run(
              { schoolId: schoolIdA, isBypass: false, userId: null },
              async () => {
                const observations: (string | null | undefined)[] = [];
                // Multiple async checkpoints to simulate real workload
                observations.push(tenantContext.getSchoolId());
                await new Promise((resolve) => setTimeout(resolve, 0));
                observations.push(tenantContext.getSchoolId());
                await new Promise((resolve) => setTimeout(resolve, 1));
                observations.push(tenantContext.getSchoolId());
                return observations;
              },
            ),
            tenantContext.run(
              { schoolId: schoolIdB, isBypass: false, userId: null },
              async () => {
                const observations: (string | null | undefined)[] = [];
                observations.push(tenantContext.getSchoolId());
                await new Promise((resolve) => setTimeout(resolve, 0));
                observations.push(tenantContext.getSchoolId());
                await new Promise((resolve) => setTimeout(resolve, 1));
                observations.push(tenantContext.getSchoolId());
                return observations;
              },
            ),
          ]);

          // All observations in scope A must be schoolIdA
          for (const obs of results[0]) {
            expect(obs).toBe(schoolIdA);
          }
          // All observations in scope B must be schoolIdB
          for (const obs of results[1]) {
            expect(obs).toBe(schoolIdB);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
