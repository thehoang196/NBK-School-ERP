import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../../src/modules/compensation/services/audit.service';
import { AuditLogRepository } from '../../../src/modules/compensation/repositories/audit-log.repository';

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<AuditLogRepository>;

  const mockAuditLog = {
    id: 'audit-1',
    entityType: 'formula',
    entityId: 'formula-1',
    action: 'create',
    oldValue: null,
    newValue: { expression: 'A + B' },
    performedBy: 'user-1',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: AuditLogRepository,
          useValue: {
            create: jest.fn(),
            findAllWithFilters: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get(AuditLogRepository);
  });

  describe('logChange', () => {
    it('should create an audit log entry', async () => {
      repository.create.mockResolvedValue(mockAuditLog as never);

      const result = await service.logChange(
        'formula',
        'formula-1',
        'create',
        null,
        { expression: 'A + B' },
        'user-1',
      );

      expect(result).toEqual(mockAuditLog);
      expect(repository.create).toHaveBeenCalledWith({
        entityType: 'formula',
        entityId: 'formula-1',
        action: 'create',
        oldValue: null,
        newValue: { expression: 'A + B' },
        performedBy: 'user-1',
        metadata: null,
      });
    });

    it('should include metadata when provided', async () => {
      repository.create.mockResolvedValue(mockAuditLog as never);

      await service.logChange(
        'calculation',
        'calc-1',
        'calculate',
        null,
        { totalTeachers: 50 },
        'user-1',
        { payPeriodId: 'pp-1' },
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { payPeriodId: 'pp-1' },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      repository.findAllWithFilters.mockResolvedValue([
        [mockAuditLog],
        1,
      ] as never);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortOrder: 'DESC',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should pass filters to repository', async () => {
      repository.findAllWithFilters.mockResolvedValue([[], 0] as never);

      await service.findAll({
        page: 1,
        limit: 10,
        sortOrder: 'DESC',
        entityType: 'formula',
        performedBy: 'user-1',
        action: 'update',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(repository.findAllWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'formula',
          performedBy: 'user-1',
          action: 'update',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        }),
      );
    });
  });
});
