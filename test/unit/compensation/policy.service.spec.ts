import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PolicyService } from '../../../src/modules/compensation/services/policy.service';
import { PolicyRepository } from '../../../src/modules/compensation/repositories/policy.repository';
import { AuditLogRepository } from '../../../src/modules/compensation/repositories/audit-log.repository';
import { EntityStatus } from '../../../src/common/enums/status.enum';

describe('PolicyService', () => {
  let service: PolicyService;
  let repository: jest.Mocked<PolicyRepository>;
  let auditRepository: jest.Mocked<AuditLogRepository>;

  const mockPolicy = {
    id: 'policy-1',
    schoolId: 'school-1',
    name: 'Chính sách lương GV THPT',
    campusId: null,
    schoolLevel: 'THPT',
    payComponentIds: ['pc-1', 'pc-2'],
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: EntityStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        {
          provide: PolicyRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findOverlapping: jest.fn(),
            findActiveByScope: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: AuditLogRepository,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
    repository = module.get(PolicyRepository);
    auditRepository = module.get(AuditLogRepository);
  });

  describe('create', () => {
    it('should create a policy successfully when no overlap', async () => {
      repository.findOverlapping.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockPolicy as never);

      const result = await service.create({
        schoolId: 'school-1',
        name: 'Chính sách lương GV THPT',
        schoolLevel: 'THPT',
        payComponentIds: ['pc-1', 'pc-2'],
        effectiveFrom: '2026-01-01',
      });

      expect(result).toEqual(mockPolicy);
    });

    it('should reject when overlapping policy exists', async () => {
      repository.findOverlapping.mockResolvedValue([mockPolicy] as never);

      await expect(
        service.create({
          schoolId: 'school-1',
          name: 'Another THPT Policy',
          schoolLevel: 'THPT',
          payComponentIds: ['pc-1'],
          effectiveFrom: '2026-06-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolvePolicy', () => {
    it('should resolve most specific policy (campus + level wins over general)', async () => {
      const generalPolicy = { ...mockPolicy, id: 'p-general', campusId: null, schoolLevel: null };
      const levelPolicy = { ...mockPolicy, id: 'p-level', campusId: null, schoolLevel: 'THPT' };
      const campusLevelPolicy = { ...mockPolicy, id: 'p-campus-level', campusId: 'campus-1', schoolLevel: 'THPT' };

      repository.findActiveByScope.mockResolvedValue([generalPolicy, levelPolicy, campusLevelPolicy] as never);

      const result = await service.resolvePolicy('school-1', 'campus-1', 'THPT', '2026-01-15');

      expect(result?.id).toBe('p-campus-level');
    });

    it('should return null when no active policy found', async () => {
      repository.findActiveByScope.mockResolvedValue([]);

      const result = await service.resolvePolicy('school-1', null, null, '2026-01-15');

      expect(result).toBeNull();
    });

    it('should prefer level-specific over general when no campus match', async () => {
      const generalPolicy = { ...mockPolicy, id: 'p-general', campusId: null, schoolLevel: null };
      const levelPolicy = { ...mockPolicy, id: 'p-level', campusId: null, schoolLevel: 'THPT' };

      repository.findActiveByScope.mockResolvedValue([generalPolicy, levelPolicy] as never);

      const result = await service.resolvePolicy('school-1', null, 'THPT', '2026-01-15');

      expect(result?.id).toBe('p-level');
    });
  });

  describe('update', () => {
    it('should update policy successfully', async () => {
      const updatedPolicy = { ...mockPolicy, name: 'New Name' };
      repository.findById.mockResolvedValue(mockPolicy as never);
      repository.findOverlapping.mockResolvedValue([]);
      repository.update.mockResolvedValue(updatedPolicy as never);

      const result = await service.update('policy-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException for non-existing policy', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existing')).rejects.toThrow(NotFoundException);
    });
  });
});
