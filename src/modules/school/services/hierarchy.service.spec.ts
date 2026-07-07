import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { HierarchyService, HierarchyNode } from './hierarchy.service';
import { SchoolEntity } from '../entities/school.entity';
import { CacheService } from '../../cache/cache.service';
import { SchoolStatus } from '../../../common/enums/status.enum';

describe('HierarchyService', () => {
  let service: HierarchyService;
  let schoolRepo: jest.Mocked<Repository<SchoolEntity>>;
  let cacheService: jest.Mocked<CacheService>;

  // --- Factory helpers ---
  const createMockSchool = (
    overrides: Partial<SchoolEntity> = {},
  ): SchoolEntity => ({
    id: 'school-default-id',
    code: 'SCH01',
    name: 'Trường Mặc Định',
    address: null,
    phone: null,
    email: null,
    principalName: null,
    parentSchoolId: null,
    parentSchool: null,
    childSchools: [],
    status: SchoolStatus.ACTIVE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  });

  // 3-level hierarchy: Holding → Company → School
  const holdingSchool = createMockSchool({
    id: 'holding-id',
    code: 'HOLD',
    name: 'Tập đoàn NBK',
    parentSchoolId: null,
  });

  const companySchoolA = createMockSchool({
    id: 'company-a-id',
    code: 'COMP_A',
    name: 'Công ty A',
    parentSchoolId: 'holding-id',
  });

  const companySchoolB = createMockSchool({
    id: 'company-b-id',
    code: 'COMP_B',
    name: 'Công ty B',
    parentSchoolId: 'holding-id',
  });

  const leafSchool1 = createMockSchool({
    id: 'leaf-1-id',
    code: 'LEAF1',
    name: 'Trường Lá 1',
    parentSchoolId: 'company-a-id',
  });

  const leafSchool2 = createMockSchool({
    id: 'leaf-2-id',
    code: 'LEAF2',
    name: 'Trường Lá 2',
    parentSchoolId: 'company-a-id',
  });

  const leafSchool3 = createMockSchool({
    id: 'leaf-3-id',
    code: 'LEAF3',
    name: 'Trường Lá 3',
    parentSchoolId: 'company-b-id',
  });

  beforeEach(async () => {
    const mockSchoolRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      getOrSet: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HierarchyService,
        {
          provide: getRepositoryToken(SchoolEntity),
          useValue: mockSchoolRepo,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<HierarchyService>(HierarchyService);
    schoolRepo = module.get(
      getRepositoryToken(SchoolEntity),
    ) as jest.Mocked<Repository<SchoolEntity>>;
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;

    // By default, cacheService.getOrSet passes through to factory
    cacheService.getOrSet.mockImplementation(
      async (_key: string, factory: () => Promise<unknown>) => factory(),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDescendants', () => {
    it('should return all levels of descendants (children + grandchildren) for a 3-level hierarchy', async () => {
      // Holding → [CompanyA, CompanyB]
      // CompanyA → [Leaf1, Leaf2]
      // CompanyB → [Leaf3]
      schoolRepo.find.mockImplementation(async (options: any) => {
        const parentId = options?.where?.parentSchoolId;
        if (parentId === 'holding-id') {
          return [companySchoolA, companySchoolB];
        }
        if (parentId === 'company-a-id') {
          return [leafSchool1, leafSchool2];
        }
        if (parentId === 'company-b-id') {
          return [leafSchool3];
        }
        return [];
      });

      const result = await service.getDescendants('holding-id');

      // Should contain all 5 descendants across 2 levels
      expect(result).toHaveLength(5);
      expect(result).toContainEqual(companySchoolA);
      expect(result).toContainEqual(companySchoolB);
      expect(result).toContainEqual(leafSchool1);
      expect(result).toContainEqual(leafSchool2);
      expect(result).toContainEqual(leafSchool3);
    });

    it('should return empty array for a leaf node with no children', async () => {
      schoolRepo.find.mockResolvedValue([]);

      const result = await service.getDescendants('leaf-1-id');

      expect(result).toEqual([]);
      expect(schoolRepo.find).toHaveBeenCalledWith({
        where: {
          parentSchoolId: 'leaf-1-id',
          deletedAt: IsNull(),
        },
      });
    });

    it('should return only direct children when there are no grandchildren', async () => {
      schoolRepo.find.mockImplementation(async (options: any) => {
        const parentId = options?.where?.parentSchoolId;
        if (parentId === 'company-a-id') {
          return [leafSchool1, leafSchool2];
        }
        return [];
      });

      const result = await service.getDescendants('company-a-id');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(leafSchool1);
      expect(result).toContainEqual(leafSchool2);
    });
  });

  describe('getAncestors', () => {
    it('should return full parent chain from deep node to root', async () => {
      // leaf-1-id → company-a-id → holding-id (root)
      schoolRepo.findOne.mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 'leaf-1-id') return leafSchool1;
        if (id === 'company-a-id') return companySchoolA;
        if (id === 'holding-id') return holdingSchool;
        return null;
      });

      const result = await service.getAncestors('leaf-1-id');

      // Should return [companySchoolA, holdingSchool] (parent → grandparent)
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(companySchoolA);
      expect(result[1]).toEqual(holdingSchool);
    });

    it('should return empty array for a root node (no parent)', async () => {
      schoolRepo.findOne.mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 'holding-id') return holdingSchool;
        return null;
      });

      const result = await service.getAncestors('holding-id');

      // Root has parentSchoolId = null, so no ancestors
      expect(result).toEqual([]);
    });

    it('should return single parent when node is one level below root', async () => {
      schoolRepo.findOne.mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 'company-a-id') return companySchoolA;
        if (id === 'holding-id') return holdingSchool;
        return null;
      });

      const result = await service.getAncestors('company-a-id');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(holdingSchool);
    });

    it('should return empty array when school does not exist', async () => {
      schoolRepo.findOne.mockResolvedValue(null);

      const result = await service.getAncestors('non-existent-id');

      expect(result).toEqual([]);
    });

    it('should stop traversal and log warning on circular reference (safety counter)', async () => {
      // Create a circular reference: A → B → A → B → ...
      const circularA = createMockSchool({
        id: 'circular-a',
        parentSchoolId: 'circular-b',
      });
      const circularB = createMockSchool({
        id: 'circular-b',
        parentSchoolId: 'circular-a',
      });

      schoolRepo.findOne.mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 'circular-a') return circularA;
        if (id === 'circular-b') return circularB;
        return null;
      });

      const result = await service.getAncestors('circular-a');

      // Safety counter should prevent infinite loop (max 100 iterations)
      expect(result.length).toBe(100);
    });
  });

  describe('resolveHierarchy', () => {
    it('should build correct tree with nested children nodes', async () => {
      // Holding → [CompanyA] → [Leaf1]
      schoolRepo.findOne.mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 'holding-id') return holdingSchool;
        return null;
      });

      schoolRepo.find.mockImplementation(async (options: any) => {
        const parentId = options?.where?.parentSchoolId;
        if (parentId === 'holding-id') return [companySchoolA];
        if (parentId === 'company-a-id') return [leafSchool1];
        if (parentId === 'leaf-1-id') return [];
        return [];
      });

      const result = await service.resolveHierarchy('holding-id');

      expect(result).not.toBeNull();
      expect(result!.school).toEqual(holdingSchool);
      expect(result!.children).toHaveLength(1);
      expect(result!.children[0].school).toEqual(companySchoolA);
      expect(result!.children[0].children).toHaveLength(1);
      expect(result!.children[0].children[0].school).toEqual(leafSchool1);
      expect(result!.children[0].children[0].children).toEqual([]);
    });

    it('should return null for non-existent school', async () => {
      schoolRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveHierarchy('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return node with empty children for leaf school', async () => {
      schoolRepo.findOne.mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 'leaf-1-id') return leafSchool1;
        return null;
      });
      schoolRepo.find.mockResolvedValue([]);

      const result = await service.resolveHierarchy('leaf-1-id');

      expect(result).not.toBeNull();
      expect(result!.school).toEqual(leafSchool1);
      expect(result!.children).toEqual([]);
    });

    it('should build tree with multiple children at same level', async () => {
      schoolRepo.findOne.mockImplementation(async (options: any) => {
        const id = options?.where?.id;
        if (id === 'company-a-id') return companySchoolA;
        return null;
      });

      schoolRepo.find.mockImplementation(async (options: any) => {
        const parentId = options?.where?.parentSchoolId;
        if (parentId === 'company-a-id') return [leafSchool1, leafSchool2];
        return [];
      });

      const result = await service.resolveHierarchy('company-a-id');

      expect(result).not.toBeNull();
      expect(result!.school).toEqual(companySchoolA);
      expect(result!.children).toHaveLength(2);
      expect(result!.children[0].school).toEqual(leafSchool1);
      expect(result!.children[1].school).toEqual(leafSchool2);
    });
  });

  describe('Cache behavior', () => {
    it('should call cacheService.getOrSet with correct key and TTL for getDescendants', async () => {
      schoolRepo.find.mockResolvedValue([]);

      await service.getDescendants('school-123');

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'hierarchy:descendants:school-123',
        expect.any(Function),
        { ttl: 900 },
      );
    });

    it('should call cacheService.getOrSet with correct key and TTL for getAncestors', async () => {
      schoolRepo.findOne.mockResolvedValue(null);

      await service.getAncestors('school-456');

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'hierarchy:ancestors:school-456',
        expect.any(Function),
        { ttl: 900 },
      );
    });

    it('should call cacheService.getOrSet with correct key and TTL for resolveHierarchy', async () => {
      schoolRepo.findOne.mockResolvedValue(null);

      await service.resolveHierarchy('school-789');

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'hierarchy:tree:school-789',
        expect.any(Function),
        { ttl: 900 },
      );
    });

    it('should return cached value without calling repo when cache hits', async () => {
      const cachedDescendants = [leafSchool1, leafSchool2];
      cacheService.getOrSet.mockResolvedValue(cachedDescendants);

      const result = await service.getDescendants('company-a-id');

      expect(result).toEqual(cachedDescendants);
      // Repo should NOT be called because cache returned value
      expect(schoolRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('invalidateHierarchyCache', () => {
    it('should delete specific cache keys and call delByPattern with hierarchy: prefix', async () => {
      cacheService.del.mockResolvedValue(undefined);
      cacheService.delByPattern.mockResolvedValue(undefined);

      await service.invalidateHierarchyCache('school-abc');

      // Should delete 3 specific keys
      expect(cacheService.del).toHaveBeenCalledWith(
        'hierarchy:descendants:school-abc',
      );
      expect(cacheService.del).toHaveBeenCalledWith(
        'hierarchy:ancestors:school-abc',
      );
      expect(cacheService.del).toHaveBeenCalledWith(
        'hierarchy:tree:school-abc',
      );

      // Should also clear all hierarchy cache by pattern
      expect(cacheService.delByPattern).toHaveBeenCalledWith('hierarchy:');
    });

    it('should call delByPattern to invalidate related hierarchy caches of other nodes', async () => {
      cacheService.del.mockResolvedValue(undefined);
      cacheService.delByPattern.mockResolvedValue(undefined);

      await service.invalidateHierarchyCache('holding-id');

      // delByPattern clears all hierarchy: prefixed keys (ancestors/descendants of other nodes may be affected)
      expect(cacheService.delByPattern).toHaveBeenCalledWith('hierarchy:');
      expect(cacheService.delByPattern).toHaveBeenCalledTimes(1);
    });
  });
});
