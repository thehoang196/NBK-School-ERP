import { TenantContextService } from '../tenant-context.service';
import { runWithTenantContext } from './run-with-tenant-context';

describe('runWithTenantContext', () => {
  let tenantContext: TenantContextService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
  });

  it('should execute callback within a tenant context with the given schoolId', async () => {
    const schoolId = 'school-123';

    const result = await runWithTenantContext(tenantContext, schoolId, async () => {
      return tenantContext.getSchoolId();
    });

    expect(result).toBe(schoolId);
  });

  it('should set isBypass to false', async () => {
    const schoolId = 'school-456';

    await runWithTenantContext(tenantContext, schoolId, async () => {
      expect(tenantContext.isBypass()).toBe(false);
      return;
    });
  });

  it('should set userId to null', async () => {
    const schoolId = 'school-789';

    await runWithTenantContext(tenantContext, schoolId, async () => {
      const store = tenantContext.getStore();
      expect(store?.userId).toBeNull();
      return;
    });
  });

  it('should return the result of the callback', async () => {
    const schoolId = 'school-abc';
    const expected = { data: 'test-result', count: 42 };

    const result = await runWithTenantContext(tenantContext, schoolId, async () => {
      return expected;
    });

    expect(result).toEqual(expected);
  });

  it('should propagate errors from the callback', async () => {
    const schoolId = 'school-err';
    const error = new Error('Something went wrong');

    await expect(
      runWithTenantContext(tenantContext, schoolId, async () => {
        throw error;
      }),
    ).rejects.toThrow('Something went wrong');
  });

  it('should not have active context after execution completes', async () => {
    const schoolId = 'school-done';

    await runWithTenantContext(tenantContext, schoolId, async () => {
      return 'done';
    });

    expect(tenantContext.isActive()).toBe(false);
    expect(tenantContext.getStore()).toBeUndefined();
  });
});
