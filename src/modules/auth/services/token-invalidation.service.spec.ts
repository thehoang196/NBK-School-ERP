import { TokenInvalidationService } from './token-invalidation.service';

describe('TokenInvalidationService', () => {
  let service: TokenInvalidationService;

  beforeEach(() => {
    service = new TokenInvalidationService();
  });

  describe('invalidateUserTokens', () => {
    it('should set invalidation marker for user', async () => {
      const userId = 'user-123';

      await service.invalidateUserTokens(userId);

      // Token issued before invalidation should be invalid
      const isValid = await service.isTokenValid(userId, Date.now() - 1000);
      expect(isValid).toBe(false);
    });

    it('should overwrite previous invalidation timestamp', async () => {
      const userId = 'user-456';

      await service.invalidateUserTokens(userId);
      const firstInvalidationTime = Date.now();

      // Wait a bit and invalidate again
      await new Promise((resolve) => setTimeout(resolve, 10));
      await service.invalidateUserTokens(userId);

      // Token issued between first and second invalidation should still be invalid
      const isValid = await service.isTokenValid(
        userId,
        firstInvalidationTime + 5,
      );
      expect(isValid).toBe(false);
    });
  });

  describe('isTokenValid', () => {
    it('should return true when no invalidation record exists', async () => {
      const result = await service.isTokenValid('unknown-user', Date.now());
      expect(result).toBe(true);
    });

    it('should return true when token was issued AFTER invalidation', async () => {
      const userId = 'user-789';

      await service.invalidateUserTokens(userId);

      // Token issued after invalidation
      const futureIat = Date.now() + 1000;
      const result = await service.isTokenValid(userId, futureIat);
      expect(result).toBe(true);
    });

    it('should return false when token was issued BEFORE invalidation', async () => {
      const userId = 'user-abc';
      const pastIat = Date.now() - 5000;

      await service.invalidateUserTokens(userId);

      const result = await service.isTokenValid(userId, pastIat);
      expect(result).toBe(false);
    });

    it('should return true when cache entry has expired', async () => {
      const userId = 'user-expired';

      // Manually inject an expired cache entry via invalidation + time manipulation
      await service.invalidateUserTokens(userId);

      // Access the internal cache to force expiration (for testing purposes)
      const cacheMap = (
        service as unknown as {
          cache: Map<string, { invalidatedAt: number; expiresAt: number }>;
        }
      ).cache;
      const key = `token:invalid:${userId}`;
      const entry = cacheMap.get(key);
      if (entry) {
        entry.expiresAt = Date.now() - 1; // Force expire
      }

      const result = await service.isTokenValid(userId, Date.now() - 100000);
      expect(result).toBe(true);
    });

    it('should handle multiple users independently', async () => {
      const userId1 = 'user-one';
      const userId2 = 'user-two';

      await service.invalidateUserTokens(userId1);

      // user-one should be invalid with old token
      const result1 = await service.isTokenValid(userId1, Date.now() - 1000);
      expect(result1).toBe(false);

      // user-two has no invalidation, should be valid
      const result2 = await service.isTokenValid(userId2, Date.now() - 1000);
      expect(result2).toBe(true);
    });
  });

  describe('clearInvalidation', () => {
    it('should remove invalidation record for user', async () => {
      const userId = 'user-clear';
      const pastIat = Date.now() - 5000;

      await service.invalidateUserTokens(userId);

      // Token should be invalid before clear
      let result = await service.isTokenValid(userId, pastIat);
      expect(result).toBe(false);

      // Clear invalidation
      await service.clearInvalidation(userId);

      // Token should be valid after clear
      result = await service.isTokenValid(userId, pastIat);
      expect(result).toBe(true);
    });

    it('should not throw when clearing non-existent invalidation', async () => {
      await expect(
        service.clearInvalidation('non-existent-user'),
      ).resolves.not.toThrow();
    });
  });
});
