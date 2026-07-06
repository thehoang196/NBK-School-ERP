import { TenantContextService } from '../tenant-context.service';
import { runWithBypass } from './run-with-bypass';

describe('runWithBypass', () => {
  let tenantContext: TenantContextService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
  });

  it('should execute callback with bypass context (schoolId=null, isBypass=true)', async () => {
    const result = await runWithBypass(tenantContext, async () => {
      const store = tenantContext.getStore();
      expect(store).toBeDefined();
      expect(store!.schoolId).toBeNull();
      expect(store!.isBypass).toBe(true);
      expect(store!.userId).toBeNull();
      return 'bypass-result';
    });

    expect(result).toBe('bypass-result');
  });

  it('should return the value produced by the callback', async () => {
    const expected = { data: [1, 2, 3], total: 3 };

    const result = await runWithBypass(tenantContext, async () => expected);

    expect(result).toEqual(expected);
  });

  it('should report isBypass() as true within the scope', async () => {
    await runWithBypass(tenantContext, async () => {
      expect(tenantContext.isBypass()).toBe(true);
    });
  });

  it('should report getSchoolId() as null within the scope', async () => {
    await runWithBypass(tenantContext, async () => {
      expect(tenantContext.getSchoolId()).toBeNull();
    });
  });

  it('should not have an active context after callback completes', async () => {
    await runWithBypass(tenantContext, async () => {
      expect(tenantContext.isActive()).toBe(true);
    });

    expect(tenantContext.isActive()).toBe(false);
    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('should propagate errors thrown by the callback', async () => {
    const error = new Error('something went wrong');

    await expect(
      runWithBypass(tenantContext, async () => {
        throw error;
      }),
    ).rejects.toThrow('something went wrong');
  });
});
