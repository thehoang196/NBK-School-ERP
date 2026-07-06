import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagRepository } from './feature-flag.repository';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let repository: jest.Mocked<FeatureFlagRepository>;

  const mockRepository = {
    findByOrgAndKey: jest.fn(),
    findByOrganization: jest.fn(),
    upsert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: FeatureFlagRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
    repository = module.get(FeatureFlagRepository);

    jest.clearAllMocks();
    // Clear cache between tests
    service.invalidateCache('org-1');
    service.invalidateCache('org-2');
  });

  describe('isCrossSchoolEnabled', () => {
    it('should return true when feature flag is enabled in DB', async () => {
      mockRepository.findByOrgAndKey.mockResolvedValue({
        id: 'flag-1',
        organizationId: 'org-1',
        flagKey: 'CROSS_SCHOOL_ENABLED',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.isCrossSchoolEnabled('org-1');

      expect(result).toBe(true);
      expect(mockRepository.findByOrgAndKey).toHaveBeenCalledWith(
        'org-1',
        'CROSS_SCHOOL_ENABLED',
      );
    });

    it('should return false when feature flag is disabled in DB', async () => {
      mockRepository.findByOrgAndKey.mockResolvedValue({
        id: 'flag-1',
        organizationId: 'org-1',
        flagKey: 'CROSS_SCHOOL_ENABLED',
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.isCrossSchoolEnabled('org-1');

      expect(result).toBe(false);
    });

    it('should return false when no feature flag record exists', async () => {
      mockRepository.findByOrgAndKey.mockResolvedValue(null);

      const result = await service.isCrossSchoolEnabled('org-2');

      expect(result).toBe(false);
    });

    it('should use cached value on subsequent calls', async () => {
      mockRepository.findByOrgAndKey.mockResolvedValue({
        id: 'flag-1',
        organizationId: 'org-1',
        flagKey: 'CROSS_SCHOOL_ENABLED',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // First call - hits DB
      const result1 = await service.isCrossSchoolEnabled('org-1');
      // Second call - should use cache
      const result2 = await service.isCrossSchoolEnabled('org-1');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockRepository.findByOrgAndKey).toHaveBeenCalledTimes(1);
    });

    it('should query DB after cache invalidation', async () => {
      mockRepository.findByOrgAndKey.mockResolvedValue({
        id: 'flag-1',
        organizationId: 'org-1',
        flagKey: 'CROSS_SCHOOL_ENABLED',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // First call - hits DB
      await service.isCrossSchoolEnabled('org-1');

      // Invalidate cache
      service.invalidateCache('org-1');

      // Change mock response
      mockRepository.findByOrgAndKey.mockResolvedValue({
        id: 'flag-1',
        organizationId: 'org-1',
        flagKey: 'CROSS_SCHOOL_ENABLED',
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Should query DB again
      const result = await service.isCrossSchoolEnabled('org-1');

      expect(result).toBe(false);
      expect(mockRepository.findByOrgAndKey).toHaveBeenCalledTimes(2);
    });

    it('should query DB after cache TTL expires', async () => {
      mockRepository.findByOrgAndKey.mockResolvedValue({
        id: 'flag-1',
        organizationId: 'org-1',
        flagKey: 'CROSS_SCHOOL_ENABLED',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // First call
      await service.isCrossSchoolEnabled('org-1');

      // Simulate TTL expiry by manipulating time
      jest.useFakeTimers();
      jest.advanceTimersByTime(5 * 60 * 1000 + 1); // 5 min + 1ms

      // Should query DB again after TTL
      await service.isCrossSchoolEnabled('org-1');

      expect(mockRepository.findByOrgAndKey).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe('invalidateCache', () => {
    it('should clear cached value for organization', async () => {
      mockRepository.findByOrgAndKey.mockResolvedValue({
        id: 'flag-1',
        organizationId: 'org-1',
        flagKey: 'CROSS_SCHOOL_ENABLED',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Populate cache
      await service.isCrossSchoolEnabled('org-1');
      expect(mockRepository.findByOrgAndKey).toHaveBeenCalledTimes(1);

      // Invalidate
      service.invalidateCache('org-1');

      // Next call should query DB
      await service.isCrossSchoolEnabled('org-1');
      expect(mockRepository.findByOrgAndKey).toHaveBeenCalledTimes(2);
    });
  });
});
