import { Test, TestingModule } from '@nestjs/testing';
import { AccessibleSchoolsCacheService } from './accessible-schools-cache.service';
import { CacheService } from '../../cache/cache.service';

describe('AccessibleSchoolsCacheService', () => {
  let service: AccessibleSchoolsCacheService;
  let cacheService: jest.Mocked<CacheService>;

  const mockUserId = 'user-uuid-123';
  const mockSchoolIds = ['school-uuid-1', 'school-uuid-2', 'school-uuid-3'];

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessibleSchoolsCacheService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<AccessibleSchoolsCacheService>(
      AccessibleSchoolsCacheService,
    );
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  describe('getCachedSchoolIds', () => {
    it('should return cached school IDs on cache hit', async () => {
      cacheService.get.mockResolvedValue(mockSchoolIds);

      const result = await service.getCachedSchoolIds(mockUserId);

      expect(result).toEqual(mockSchoolIds);
      expect(cacheService.get).toHaveBeenCalledWith(
        `accessible-schools:${mockUserId}`,
      );
    });

    it('should return null on cache miss', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await service.getCachedSchoolIds(mockUserId);

      expect(result).toBeNull();
    });

    it('should return null and log warning on cache error', async () => {
      cacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getCachedSchoolIds(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('setCachedSchoolIds', () => {
    it('should cache school IDs with TTL 300 seconds', async () => {
      cacheService.set.mockResolvedValue(undefined);

      await service.setCachedSchoolIds(mockUserId, mockSchoolIds);

      expect(cacheService.set).toHaveBeenCalledWith(
        `accessible-schools:${mockUserId}`,
        mockSchoolIds,
        { ttl: 300 },
      );
    });

    it('should not throw on cache error', async () => {
      cacheService.set.mockRejectedValue(new Error('Redis write failed'));

      await expect(
        service.setCachedSchoolIds(mockUserId, mockSchoolIds),
      ).resolves.toBeUndefined();
    });

    it('should cache empty array when no accessible schools', async () => {
      cacheService.set.mockResolvedValue(undefined);

      await service.setCachedSchoolIds(mockUserId, []);

      expect(cacheService.set).toHaveBeenCalledWith(
        `accessible-schools:${mockUserId}`,
        [],
        { ttl: 300 },
      );
    });
  });

  describe('invalidateForUser', () => {
    it('should delete cache for specific user', async () => {
      cacheService.del.mockResolvedValue(undefined);

      await service.invalidateForUser(mockUserId);

      expect(cacheService.del).toHaveBeenCalledWith(
        `accessible-schools:${mockUserId}`,
      );
    });

    it('should not throw on cache error', async () => {
      cacheService.del.mockRejectedValue(new Error('Redis delete failed'));

      await expect(
        service.invalidateForUser(mockUserId),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateAll', () => {
    it('should delete all accessible schools caches by pattern', async () => {
      cacheService.delByPattern.mockResolvedValue(undefined);

      await service.invalidateAll();

      expect(cacheService.delByPattern).toHaveBeenCalledWith(
        'accessible-schools:',
      );
    });

    it('should not throw on cache error', async () => {
      cacheService.delByPattern.mockRejectedValue(
        new Error('Redis pattern delete failed'),
      );

      await expect(service.invalidateAll()).resolves.toBeUndefined();
    });
  });

  describe('TTL expiry behavior', () => {
    it('should return null after TTL expires (simulated by cache returning null)', async () => {
      // First call: cache hit
      cacheService.get.mockResolvedValueOnce(mockSchoolIds);
      const cachedResult = await service.getCachedSchoolIds(mockUserId);
      expect(cachedResult).toEqual(mockSchoolIds);

      // After TTL (300s) expires: cache returns null
      cacheService.get.mockResolvedValueOnce(null);
      const expiredResult = await service.getCachedSchoolIds(mockUserId);
      expect(expiredResult).toBeNull();
    });

    it('should always set TTL to 300 seconds regardless of data size', async () => {
      cacheService.set.mockResolvedValue(undefined);

      // Single school
      await service.setCachedSchoolIds('user-single', ['school-1']);
      expect(cacheService.set).toHaveBeenCalledWith(
        'accessible-schools:user-single',
        ['school-1'],
        { ttl: 300 },
      );

      // Max schools (50)
      const maxSchools = Array.from({ length: 50 }, (_, i) => `school-${i}`);
      await service.setCachedSchoolIds('user-max', maxSchools);
      expect(cacheService.set).toHaveBeenCalledWith(
        'accessible-schools:user-max',
        maxSchools,
        { ttl: 300 },
      );
    });
  });

  describe('invalidation on role/permission change events', () => {
    it('should invalidate user cache so next read returns null after role change', async () => {
      const userId = 'user-role-changed';

      // Step 1: Cache hit — user has schools cached
      cacheService.get.mockResolvedValueOnce(['school-a', 'school-b']);
      const before = await service.getCachedSchoolIds(userId);
      expect(before).toEqual(['school-a', 'school-b']);

      // Step 2: Role changes — invalidate user's cache
      cacheService.del.mockResolvedValue(undefined);
      await service.invalidateForUser(userId);
      expect(cacheService.del).toHaveBeenCalledWith(
        `accessible-schools:${userId}`,
      );

      // Step 3: Next read returns null (must recompute from DB)
      cacheService.get.mockResolvedValueOnce(null);
      const after = await service.getCachedSchoolIds(userId);
      expect(after).toBeNull();
    });

    it('should invalidate all user caches on bulk school assignment change', async () => {
      // Multiple users have caches
      cacheService.get.mockResolvedValueOnce(['school-1']);
      const cachedA = await service.getCachedSchoolIds('user-a');
      expect(cachedA).toEqual(['school-1']);

      // Bulk change (e.g., school restructuring) — invalidate all
      cacheService.delByPattern.mockResolvedValue(undefined);
      await service.invalidateAll();
      expect(cacheService.delByPattern).toHaveBeenCalledWith(
        'accessible-schools:',
      );

      // All user caches now empty
      cacheService.get.mockResolvedValueOnce(null);
      const afterA = await service.getCachedSchoolIds('user-a');
      expect(afterA).toBeNull();

      cacheService.get.mockResolvedValueOnce(null);
      const afterB = await service.getCachedSchoolIds('user-b');
      expect(afterB).toBeNull();
    });

    it('should handle invalidation failure gracefully without affecting reads', async () => {
      const userId = 'user-resilient';

      // Invalidation fails (Redis temporarily unavailable)
      cacheService.del.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.invalidateForUser(userId)).resolves.toBeUndefined();

      // Read still works independently
      cacheService.get.mockResolvedValue(['school-x']);
      const result = await service.getCachedSchoolIds(userId);
      expect(result).toEqual(['school-x']);
    });
  });
});
