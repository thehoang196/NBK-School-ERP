import { Test, TestingModule } from '@nestjs/testing';
import { PermissionCacheService } from './permission-cache.service';
import { CacheService } from '../../cache/cache.service';

describe('PermissionCacheService', () => {
  let service: PermissionCacheService;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCacheService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<PermissionCacheService>(PermissionCacheService);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  describe('getCachedPermissions', () => {
    it('should return cached permissions for a role', async () => {
      const roleId = 'role-123';
      const permissions = ['teacher:read', 'teacher:create', 'timetable:read'];
      cacheService.get.mockResolvedValue(permissions);

      const result = await service.getCachedPermissions(roleId);

      expect(result).toEqual(permissions);
      expect(cacheService.get).toHaveBeenCalledWith('permission:role-123');
    });

    it('should return null when no cache exists', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await service.getCachedPermissions('role-456');

      expect(result).toBeNull();
      expect(cacheService.get).toHaveBeenCalledWith('permission:role-456');
    });

    it('should return null and log warning on cache error', async () => {
      cacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getCachedPermissions('role-789');

      expect(result).toBeNull();
    });
  });

  describe('setCachedPermissions', () => {
    it('should cache permissions with TTL 600 seconds (10 minutes)', async () => {
      const roleId = 'role-123';
      const permissions = ['teacher:read', 'audit-log:read'];
      cacheService.set.mockResolvedValue(undefined);

      await service.setCachedPermissions(roleId, permissions);

      expect(cacheService.set).toHaveBeenCalledWith(
        'permission:role-123',
        permissions,
        { ttl: 600 },
      );
    });

    it('should not throw on cache write error', async () => {
      cacheService.set.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        service.setCachedPermissions('role-123', ['teacher:read']),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidatePermissions', () => {
    it('should delete the cached permissions for a specific role', async () => {
      cacheService.del.mockResolvedValue(undefined);

      await service.invalidatePermissions('role-123');

      expect(cacheService.del).toHaveBeenCalledWith('permission:role-123');
    });

    it('should not throw on cache delete error', async () => {
      cacheService.del.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        service.invalidatePermissions('role-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateAllPermissions', () => {
    it('should delete all keys with permission: prefix', async () => {
      cacheService.delByPattern.mockResolvedValue(undefined);

      await service.invalidateAllPermissions();

      expect(cacheService.delByPattern).toHaveBeenCalledWith('permission:');
    });

    it('should not throw on bulk delete error', async () => {
      cacheService.delByPattern.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        service.invalidateAllPermissions(),
      ).resolves.toBeUndefined();
    });
  });

  describe('TTL expiry behavior', () => {
    it('should return null after TTL expires (simulated by cache returning null)', async () => {
      const roleId = 'role-ttl-test';
      const permissions = ['teacher:read'];

      // First call: cache hit
      cacheService.get.mockResolvedValueOnce(permissions);
      const cachedResult = await service.getCachedPermissions(roleId);
      expect(cachedResult).toEqual(permissions);

      // After TTL expires: cache miss (CacheService returns null for expired entries)
      cacheService.get.mockResolvedValueOnce(null);
      const expiredResult = await service.getCachedPermissions(roleId);
      expect(expiredResult).toBeNull();
    });

    it('should always set TTL to 600 seconds regardless of permissions content', async () => {
      cacheService.set.mockResolvedValue(undefined);

      // Empty permissions
      await service.setCachedPermissions('role-empty', []);
      expect(cacheService.set).toHaveBeenCalledWith(
        'permission:role-empty',
        [],
        { ttl: 600 },
      );

      // Large permissions list
      const largePermissions = Array.from({ length: 50 }, (_, i) => `perm:${i}`);
      await service.setCachedPermissions('role-large', largePermissions);
      expect(cacheService.set).toHaveBeenCalledWith(
        'permission:role-large',
        largePermissions,
        { ttl: 600 },
      );
    });
  });

  describe('invalidation on role/permission change events', () => {
    it('should invalidate specific role cache so next read returns null', async () => {
      const roleId = 'role-changed';
      const permissions = ['teacher:read', 'teacher:create'];

      // Step 1: Cache is populated — get returns data
      cacheService.get.mockResolvedValueOnce(permissions);
      const before = await service.getCachedPermissions(roleId);
      expect(before).toEqual(permissions);

      // Step 2: Role permission changes — invalidate cache
      cacheService.del.mockResolvedValue(undefined);
      await service.invalidatePermissions(roleId);
      expect(cacheService.del).toHaveBeenCalledWith('permission:role-changed');

      // Step 3: Next read returns null (cache invalidated)
      cacheService.get.mockResolvedValueOnce(null);
      const after = await service.getCachedPermissions(roleId);
      expect(after).toBeNull();
    });

    it('should invalidate all permission caches on bulk permission change', async () => {
      // Multiple roles cached
      cacheService.get.mockResolvedValueOnce(['teacher:read']);
      const cached = await service.getCachedPermissions('role-a');
      expect(cached).toEqual(['teacher:read']);

      // Bulk permission change — invalidate all
      cacheService.delByPattern.mockResolvedValue(undefined);
      await service.invalidateAllPermissions();
      expect(cacheService.delByPattern).toHaveBeenCalledWith('permission:');

      // All caches now empty
      cacheService.get.mockResolvedValueOnce(null);
      const afterA = await service.getCachedPermissions('role-a');
      expect(afterA).toBeNull();

      cacheService.get.mockResolvedValueOnce(null);
      const afterB = await service.getCachedPermissions('role-b');
      expect(afterB).toBeNull();
    });

    it('should handle concurrent invalidation and read without throwing', async () => {
      const roleId = 'role-concurrent';

      // Simulate cache error during invalidation (Redis temporarily unavailable)
      cacheService.del.mockRejectedValueOnce(new Error('ETIMEDOUT'));
      await expect(service.invalidatePermissions(roleId)).resolves.toBeUndefined();

      // Read still works (returns whatever cache returns)
      cacheService.get.mockResolvedValue(['teacher:read']);
      const result = await service.getCachedPermissions(roleId);
      expect(result).toEqual(['teacher:read']);
    });
  });
});
