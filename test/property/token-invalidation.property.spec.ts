import * as fc from 'fast-check';
import { TokenInvalidationService } from '../../src/modules/auth/services/token-invalidation.service';

/**
 * Property-Based Tests for Token Invalidation on Assignment Change
 *
 * Property 8: Token Invalidation on Assignment Change
 * For any user, after a Teacher_School_Assignment is created or deactivated
 * for that user's linked teacher, any JWT issued before the change SHALL be
 * considered invalid (tokenIssuedAt < invalidatedAt).
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 2.4**
 */

// --- Custom Arbitraries ---

/** Generate a random user ID string */
const userIdArb = fc.uuid({ version: 4 });

/**
 * Generate a timestamp offset in milliseconds (relative to "now").
 * Negative offset = before now, positive offset = after now.
 */
const timestampOffsetArb = fc.integer({ min: 1, max: 100_000 });

describe('Feature: cross-campus-teaching | Property 8: Token Invalidation on Assignment Change', () => {
  let service: TokenInvalidationService;

  beforeEach(() => {
    service = new TokenInvalidationService();
  });

  /**
   * Property 8a: After invalidation, tokens issued BEFORE are always invalid.
   *
   * For any user and any token issued at time T where T < invalidatedAt,
   * isTokenValid SHALL return false.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 8a: Tokens issued before invalidation are always invalid', () => {
    it('any token issued before invalidation timestamp is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          timestampOffsetArb,
          async (userId, offsetBeforeMs) => {
            // 1. Invalidate user tokens (sets invalidatedAt = Date.now())
            await service.invalidateUserTokens(userId);

            // 2. Simulate a token that was issued BEFORE the invalidation
            // invalidatedAt is approximately Date.now() at the time of invalidation.
            // A token issued offsetBeforeMs ms BEFORE must be invalid.
            const tokenIssuedAt = Date.now() - offsetBeforeMs;

            // 3. Check validity
            const isValid = await service.isTokenValid(userId, tokenIssuedAt);

            // Token issued before invalidation MUST be invalid
            expect(isValid).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 8b: After invalidation, tokens issued AFTER are always valid.
   *
   * For any user and any token issued at time T where T > invalidatedAt,
   * isTokenValid SHALL return true.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 8b: Tokens issued after invalidation are always valid', () => {
    it('any token issued after invalidation timestamp is accepted', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          timestampOffsetArb,
          async (userId, offsetAfterMs) => {
            // 1. Invalidate user tokens (sets invalidatedAt = Date.now())
            await service.invalidateUserTokens(userId);

            // 2. Simulate a token that was issued AFTER the invalidation
            const tokenIssuedAt = Date.now() + offsetAfterMs;

            // 3. Check validity
            const isValid = await service.isTokenValid(userId, tokenIssuedAt);

            // Token issued after invalidation MUST be valid
            expect(isValid).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 8c: Without invalidation, all tokens are considered valid.
   *
   * For any user who has NOT had their tokens invalidated,
   * isTokenValid SHALL return true for any tokenIssuedAt timestamp.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 8c: Without invalidation, all tokens are valid', () => {
    it('tokens for non-invalidated users are always valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          fc.integer({ min: 0, max: 2_000_000_000_000 }),
          async (userId, tokenIssuedAt) => {
            // No invalidation has been performed for this user
            const isValid = await service.isTokenValid(userId, tokenIssuedAt);

            // Without invalidation, token should always be valid
            expect(isValid).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 8d: Re-invalidation updates the invalidation timestamp.
   *
   * For any user, if tokens are invalidated twice, the second invalidation
   * supersedes the first. A token issued between the two invalidation
   * timestamps is invalid after the second invalidation (but would have
   * been valid after only the first).
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 8d: Re-invalidation updates the marker to latest timestamp', () => {
    it('second invalidation supersedes the first', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          timestampOffsetArb,
          async (userId, delayMs) => {
            // 1. First invalidation
            await service.invalidateUserTokens(userId);
            const afterFirstInvalidation = Date.now();

            // Small delay simulation: token issued between first and second invalidation
            const tokenBetween = afterFirstInvalidation + 1;

            // 2. Token should be valid right after first invalidation
            const validAfterFirst = await service.isTokenValid(
              userId,
              tokenBetween,
            );
            expect(validAfterFirst).toBe(true);

            // 3. Wait a tiny bit and do second invalidation
            // We simulate the passage of time by waiting enough for Date.now() to advance
            await new Promise((resolve) => setTimeout(resolve, 2));
            await service.invalidateUserTokens(userId);

            // 4. Now the token issued between the two invalidations should be INVALID
            const validAfterSecond = await service.isTokenValid(
              userId,
              tokenBetween,
            );
            expect(validAfterSecond).toBe(false);

            // 5. A token issued after the second invalidation should be valid
            const tokenAfterSecond = Date.now() + delayMs;
            const validNew = await service.isTokenValid(
              userId,
              tokenAfterSecond,
            );
            expect(validNew).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 8e: Invalidation is user-specific (isolation).
   *
   * For any two different users A and B, invalidating user A's tokens
   * SHALL NOT affect user B's token validity.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 8e: Invalidation is user-specific (no cross-user impact)', () => {
    it('invalidating one user does not affect another user', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          userIdArb,
          fc.integer({ min: 0, max: 2_000_000_000_000 }),
          async (userA, userB, tokenIssuedAt) => {
            // Ensure different users
            fc.pre(userA !== userB);

            // Invalidate user A's tokens
            await service.invalidateUserTokens(userA);

            // User B's token should still be valid (no invalidation record)
            const isValidB = await service.isTokenValid(userB, tokenIssuedAt);
            expect(isValidB).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
