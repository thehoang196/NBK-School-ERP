import { Test, TestingModule } from '@nestjs/testing';

import { TenantContextService } from './tenant-context.service';
import { TenantStore } from './tenant.interfaces';

describe('TenantContextService', () => {
  let service: TenantContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantContextService],
    }).compile();

    service = module.get<TenantContextService>(TenantContextService);
  });

  describe('run()', () => {
    it('should execute callback within tenant context', () => {
      const store: TenantStore = {
        schoolId: 'school-123',
        isBypass: false,
        userId: 'user-456',
      };

      const result = service.run(store, () => {
        return service.getSchoolId();
      });

      expect(result).toBe('school-123');
    });

    it('should return the callback result', () => {
      const store: TenantStore = {
        schoolId: 'school-123',
        isBypass: false,
        userId: 'user-456',
      };

      const result = service.run(store, () => 42);

      expect(result).toBe(42);
    });
  });

  describe('getStore()', () => {
    it('should return undefined when outside a context', () => {
      expect(service.getStore()).toBeUndefined();
    });

    it('should return the store when inside a context', () => {
      const store: TenantStore = {
        schoolId: 'school-abc',
        isBypass: false,
        userId: 'user-xyz',
      };

      service.run(store, () => {
        expect(service.getStore()).toEqual(store);
      });
    });
  });

  describe('getSchoolId()', () => {
    it('should return undefined when no context is active', () => {
      expect(service.getSchoolId()).toBeUndefined();
    });

    it('should return schoolId from the active context', () => {
      const store: TenantStore = {
        schoolId: 'school-id-1',
        isBypass: false,
        userId: 'user-1',
      };

      service.run(store, () => {
        expect(service.getSchoolId()).toBe('school-id-1');
      });
    });

    it('should return null when schoolId is null (bypass mode)', () => {
      const store: TenantStore = {
        schoolId: null,
        isBypass: true,
        userId: 'admin-user',
      };

      service.run(store, () => {
        expect(service.getSchoolId()).toBeNull();
      });
    });
  });

  describe('isBypass()', () => {
    it('should return false when no context is active', () => {
      expect(service.isBypass()).toBe(false);
    });

    it('should return false when isBypass is false in store', () => {
      const store: TenantStore = {
        schoolId: 'school-1',
        isBypass: false,
        userId: 'user-1',
      };

      service.run(store, () => {
        expect(service.isBypass()).toBe(false);
      });
    });

    it('should return true when isBypass is true in store', () => {
      const store: TenantStore = {
        schoolId: null,
        isBypass: true,
        userId: 'super-admin',
      };

      service.run(store, () => {
        expect(service.isBypass()).toBe(true);
      });
    });
  });

  describe('isActive()', () => {
    it('should return false when no context is active', () => {
      expect(service.isActive()).toBe(false);
    });

    it('should return true when inside a context', () => {
      const store: TenantStore = {
        schoolId: 'school-1',
        isBypass: false,
        userId: 'user-1',
      };

      service.run(store, () => {
        expect(service.isActive()).toBe(true);
      });
    });
  });

  describe('context isolation', () => {
    it('should isolate context between concurrent scopes', async () => {
      const storeA: TenantStore = {
        schoolId: 'school-A',
        isBypass: false,
        userId: 'user-A',
      };

      const storeB: TenantStore = {
        schoolId: 'school-B',
        isBypass: false,
        userId: 'user-B',
      };

      const results = await Promise.all([
        new Promise<string | null | undefined>((resolve) => {
          service.run(storeA, () => {
            // Simulate async work
            setTimeout(() => {
              resolve(service.getSchoolId());
            }, 10);
          });
        }),
        new Promise<string | null | undefined>((resolve) => {
          service.run(storeB, () => {
            setTimeout(() => {
              resolve(service.getSchoolId());
            }, 10);
          });
        }),
      ]);

      expect(results[0]).toBe('school-A');
      expect(results[1]).toBe('school-B');
    });

    it('should not leak context after run() completes', () => {
      const store: TenantStore = {
        schoolId: 'temp-school',
        isBypass: false,
        userId: 'temp-user',
      };

      service.run(store, () => {
        // Inside context
        expect(service.isActive()).toBe(true);
      });

      // Outside context
      expect(service.isActive()).toBe(false);
      expect(service.getStore()).toBeUndefined();
    });
  });
});
