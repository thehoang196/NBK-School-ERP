import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService, CreateAuditLogInput } from './audit-log.service';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditLogEntity } from '../entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: jest.Mocked<AuditLogRepository>;

  const mockAuditLog: AuditLogEntity = {
    id: 'audit-uuid-1',
    userId: 'user-uuid-1',
    schoolId: 'school-uuid-1',
    action: 'create',
    entityType: 'teacher',
    entityId: 'entity-uuid-1',
    changes: { fullName: { old: null, new: 'Nguyễn Văn A' } },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    metadata: null,
    createdAt: new Date(),
    school: null as unknown as AuditLogEntity['school'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: AuditLogRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get(AuditLogRepository);
  });

  describe('log', () => {
    it('should create audit log successfully', async () => {
      repository.create.mockResolvedValue(mockAuditLog);

      const input: CreateAuditLogInput = {
        userId: 'user-uuid-1',
        schoolId: 'school-uuid-1',
        action: 'create',
        entityType: 'teacher',
        entityId: 'entity-uuid-1',
        changes: { fullName: { old: null, new: 'Nguyễn Văn A' } },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      await service.log(input);

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-uuid-1',
        schoolId: 'school-uuid-1',
        action: 'create',
        entityType: 'teacher',
        entityId: 'entity-uuid-1',
        changes: { fullName: { old: null, new: 'Nguyễn Văn A' } },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: null,
      });
    });

    it('should not throw when repository fails', async () => {
      repository.create.mockRejectedValue(new Error('DB connection failed'));

      const input: CreateAuditLogInput = {
        userId: 'user-uuid-1',
        schoolId: 'school-uuid-1',
        action: 'create',
        entityType: 'teacher',
      };

      // Should not throw
      await expect(service.log(input)).resolves.toBeUndefined();
    });

    it('should handle null optional fields', async () => {
      repository.create.mockResolvedValue(mockAuditLog);

      const input: CreateAuditLogInput = {
        userId: null,
        schoolId: null,
        action: 'login_failed',
        entityType: 'auth',
      };

      await service.log(input);

      expect(repository.create).toHaveBeenCalledWith({
        userId: null,
        schoolId: null,
        action: 'login_failed',
        entityType: 'auth',
        entityId: null,
        changes: null,
        ipAddress: null,
        userAgent: null,
        metadata: null,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      repository.findAll.mockResolvedValue([[mockAuditLog], 1]);

      const result = await service.findAll(
        { page: 1, limit: 20 },
        'school-uuid-1',
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should pass schoolId filter to repository', async () => {
      repository.findAll.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20 }, 'school-uuid-1');

      expect(repository.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 20 },
        'school-uuid-1',
      );
    });
  });

  describe('findById', () => {
    it('should return audit log by id', async () => {
      repository.findById.mockResolvedValue(mockAuditLog);

      const result = await service.findById('audit-uuid-1');

      expect(result).toEqual(mockAuditLog);
    });

    it('should return null when not found', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });
});
