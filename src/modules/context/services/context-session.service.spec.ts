import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { ContextSessionService } from './context-session.service';
import { CacheService } from '../../cache/cache.service';
import { ContextSession } from '../interfaces/context.interfaces';

describe('ContextSessionService', () => {
  let service: ContextSessionService;
  let cacheService: jest.Mocked<CacheService>;

  const mockUserId = 'user-uuid-1234-5678-abcd';
  const mockSchoolId = 'school-uuid-1234-5678-abcd';
  const expectedKey = `context:session:${mockUserId}`;
  const SESSION_TTL = 86400; // 24 hours in seconds

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextSessionService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ContextSessionService>(ContextSessionService);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setActiveContext', () => {
    it('should store session with correct key, TTL, and contextVersion starting at 1', async () => {
      cacheService.get.mockResolvedValue(null); // No prior session
      cacheService.set.mockResolvedValue(undefined);

      await service.setActiveContext(mockUserId, mockSchoolId);

      expect(cacheService.get).toHaveBeenCalledWith(expectedKey);
      expect(cacheService.set).toHaveBeenCalledTimes(1);
      expect(cacheService.set).toHaveBeenCalledWith(
        expectedKey,
        expect.objectContaining({
          schoolId: mockSchoolId,
          switchedAt: expect.any(Number),
          contextVersion: 1,
          lastAccessAt: expect.any(Number),
        }),
        { ttl: SESSION_TTL },
      );
    });

    it('should increment contextVersion from existing session', async () => {
      const existingSession: ContextSession = {
        schoolId: 'old-school-id',
        switchedAt: 1717200000,
        contextVersion: 3,
        lastAccessAt: 1717200000,
      };
      cacheService.get.mockResolvedValue(existingSession);
      cacheService.set.mockResolvedValue(undefined);

      await service.setActiveContext(mockUserId, mockSchoolId);

      expect(cacheService.set).toHaveBeenCalledWith(
        expectedKey,
        expect.objectContaining({
          schoolId: mockSchoolId,
          contextVersion: 4,
        }),
        { ttl: SESSION_TTL },
      );
    });

    it('should store switchedAt and lastAccessAt as Unix timestamp in seconds', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      const beforeTime = Math.floor(Date.now() / 1000);

      await service.setActiveContext(mockUserId, mockSchoolId);

      const storedSession = cacheService.set.mock.calls[0][1] as ContextSession;
      const afterTime = Math.floor(Date.now() / 1000);

      expect(storedSession.switchedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(storedSession.switchedAt).toBeLessThanOrEqual(afterTime);
      expect(storedSession.lastAccessAt).toBeGreaterThanOrEqual(beforeTime);
      expect(storedSession.lastAccessAt).toBeLessThanOrEqual(afterTime);
    });

    it('should catch and log error on Redis failure', async () => {
      const redisError = new Error('Redis connection refused');
      cacheService.get.mockRejectedValue(redisError);

      // Should not throw
      await expect(
        service.setActiveContext(mockUserId, mockSchoolId),
      ).resolves.toBeUndefined();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Failed to set active context for user ${mockUserId}`,
        expect.any(String),
      );
    });
  });

  describe('getActiveContext', () => {
    it('should return schoolId when session exists and update lastAccessAt', async () => {
      const session: ContextSession = {
        schoolId: mockSchoolId,
        switchedAt: Math.floor(Date.now() / 1000),
        contextVersion: 2,
        lastAccessAt: 1717200000,
      };
      cacheService.get.mockResolvedValue(session);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getActiveContext(mockUserId);

      expect(result).toBe(mockSchoolId);
      expect(cacheService.get).toHaveBeenCalledWith(expectedKey);
      // Should re-store the session with updated lastAccessAt
      expect(cacheService.set).toHaveBeenCalledWith(
        expectedKey,
        expect.objectContaining({
          schoolId: mockSchoolId,
          contextVersion: 2,
          lastAccessAt: expect.any(Number),
        }),
        { ttl: SESSION_TTL },
      );
      // Verify lastAccessAt is current time
      const updatedSession = cacheService.set.mock.calls[0][1] as ContextSession;
      expect(updatedSession.lastAccessAt).toBeGreaterThanOrEqual(
        Math.floor(Date.now() / 1000) - 1,
      );
    });

    it('should return null when no session exists', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await service.getActiveContext(mockUserId);

      expect(result).toBeNull();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should return null on Redis timeout (500ms)', async () => {
      // Simulate a timeout by creating a promise that never resolves within 500ms
      cacheService.get.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(null), 1000); // Resolves after 1000ms, exceeding 500ms timeout
          }),
      );

      const result = await service.getActiveContext(mockUserId);

      expect(result).toBeNull();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        `Failed to get active context for user ${mockUserId}, falling back to null`,
        expect.any(String),
      );
    });

    it('should return null on Redis error', async () => {
      cacheService.get.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.getActiveContext(mockUserId);

      expect(result).toBeNull();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        `Failed to get active context for user ${mockUserId}, falling back to null`,
        expect.any(String),
      );
    });
  });

  describe('deleteSession', () => {
    it('should remove the session key', async () => {
      cacheService.del.mockResolvedValue(undefined);

      await service.deleteSession(mockUserId);

      expect(cacheService.del).toHaveBeenCalledWith(expectedKey);
    });

    it('should catch and log error on failure', async () => {
      cacheService.del.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        service.deleteSession(mockUserId),
      ).resolves.toBeUndefined();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Failed to delete context session for user ${mockUserId}`,
        expect.any(String),
      );
    });
  });

  describe('refreshTtl', () => {
    it('should re-store existing session with fresh TTL and updated lastAccessAt', async () => {
      const existingSession: ContextSession = {
        schoolId: mockSchoolId,
        switchedAt: 1717200000,
        contextVersion: 2,
        lastAccessAt: 1717200000,
      };
      cacheService.get.mockResolvedValue(existingSession);
      cacheService.set.mockResolvedValue(undefined);

      await service.refreshTtl(mockUserId);

      expect(cacheService.get).toHaveBeenCalledWith(expectedKey);
      expect(cacheService.set).toHaveBeenCalledWith(
        expectedKey,
        expect.objectContaining({
          schoolId: mockSchoolId,
          switchedAt: 1717200000,
          contextVersion: 2,
          lastAccessAt: expect.any(Number),
        }),
        { ttl: SESSION_TTL },
      );
      // Verify lastAccessAt was updated to current time
      const updatedSession = cacheService.set.mock.calls[0][1] as ContextSession;
      expect(updatedSession.lastAccessAt).toBeGreaterThan(1717200000);
    });

    it('should do nothing when no session exists', async () => {
      cacheService.get.mockResolvedValue(null);

      await service.refreshTtl(mockUserId);

      expect(cacheService.get).toHaveBeenCalledWith(expectedKey);
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should catch and log error on failure', async () => {
      cacheService.get.mockRejectedValue(new Error('Redis timeout'));

      await expect(
        service.refreshTtl(mockUserId),
      ).resolves.toBeUndefined();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        `Failed to refresh TTL for user ${mockUserId}`,
        expect.any(String),
      );
    });
  });
});
