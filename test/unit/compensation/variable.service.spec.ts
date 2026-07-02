import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { VariableService } from '../../../src/modules/compensation/services/variable.service';
import { VariableRepository } from '../../../src/modules/compensation/repositories/variable.repository';
import { AuditLogRepository } from '../../../src/modules/compensation/repositories/audit-log.repository';
import { VariableDataType, VariableScope } from '../../../src/modules/compensation/enums';

describe('VariableService', () => {
  let service: VariableService;
  let variableRepository: jest.Mocked<VariableRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  const mockVariable = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    code: 'LESSON_RATE',
    name: 'Đơn giá tiết dạy',
    dataType: VariableDataType.NUMBER,
    defaultValue: '150000',
    scope: VariableScope.SYSTEM,
    scopeId: null,
    scopeLevel: null,
    description: 'Đơn giá cơ bản cho mỗi tiết dạy',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockVariableRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findByCodes: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findOverrides: jest.fn(),
      findOverridesByContext: jest.fn(),
      createOverride: jest.fn(),
      updateOverride: jest.fn(),
      deleteOverride: jest.fn(),
    };

    const mockAuditLogRepo = {
      create: jest.fn(),
      findByEntity: jest.fn(),
      findByEntityType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariableService,
        { provide: VariableRepository, useValue: mockVariableRepo },
        { provide: AuditLogRepository, useValue: mockAuditLogRepo },
      ],
    }).compile();

    service = module.get<VariableService>(VariableService);
    variableRepository = module.get(VariableRepository);
    auditLogRepository = module.get(AuditLogRepository);
  });

  describe('findAll', () => {
    it('should return paginated variables', async () => {
      variableRepository.findAll.mockResolvedValue([[mockVariable as any], 1]);

      const result = await service.findAll({ page: 1, limit: 10, sortOrder: 'ASC' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return variable by id', async () => {
      variableRepository.findById.mockResolvedValue(mockVariable as any);
      const result = await service.findById(mockVariable.id);
      expect(result.code).toBe('LESSON_RATE');
    });

    it('should throw NotFoundException when not found', async () => {
      variableRepository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create variable with valid data', async () => {
      variableRepository.findByCode.mockResolvedValue(null);
      variableRepository.create.mockResolvedValue(mockVariable as any);

      const result = await service.create({
        code: 'LESSON_RATE',
        name: 'Đơn giá tiết dạy',
        dataType: VariableDataType.NUMBER,
        defaultValue: '150000',
        scope: VariableScope.SYSTEM,
      });

      expect(result.code).toBe('LESSON_RATE');
      expect(variableRepository.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid code format', async () => {
      await expect(
        service.create({
          code: 'invalid_code',
          name: 'Test',
          dataType: VariableDataType.NUMBER,
          scope: VariableScope.SYSTEM,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate code', async () => {
      variableRepository.findByCode.mockResolvedValue(mockVariable as any);

      await expect(
        service.create({
          code: 'LESSON_RATE',
          name: 'Duplicate',
          dataType: VariableDataType.NUMBER,
          scope: VariableScope.SYSTEM,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('resolveValue', () => {
    it('should return SCHOOL_LEVEL override (highest priority)', async () => {
      variableRepository.findByCode.mockResolvedValue(mockVariable as any);
      variableRepository.findOverridesByContext.mockResolvedValue([
        {
          id: '1',
          variableId: mockVariable.id,
          scope: VariableScope.SCHOOL_LEVEL,
          scopeId: 'school-1',
          scopeLevel: 'THPT',
          value: '350000',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: '2',
          variableId: mockVariable.id,
          scope: VariableScope.SCHOOL,
          scopeId: 'school-1',
          scopeLevel: null,
          value: '200000',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ] as any);

      const result = await service.resolveValue('LESSON_RATE', {
        schoolId: 'school-1',
        schoolLevel: 'THPT',
      });

      expect(result).toBe('350000');
    });

    it('should return SCHOOL override when no SCHOOL_LEVEL override', async () => {
      variableRepository.findByCode.mockResolvedValue(mockVariable as any);
      variableRepository.findOverridesByContext.mockResolvedValue([
        {
          id: '2',
          variableId: mockVariable.id,
          scope: VariableScope.SCHOOL,
          scopeId: 'school-1',
          scopeLevel: null,
          value: '200000',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ] as any);

      const result = await service.resolveValue('LESSON_RATE', {
        schoolId: 'school-1',
        schoolLevel: 'THPT',
      });

      expect(result).toBe('200000');
    });

    it('should return default value when no overrides', async () => {
      variableRepository.findByCode.mockResolvedValue(mockVariable as any);
      variableRepository.findOverridesByContext.mockResolvedValue([]);

      const result = await service.resolveValue('LESSON_RATE', {
        schoolId: 'school-1',
      });

      expect(result).toBe('150000');
    });

    it('should return null for unknown variable', async () => {
      variableRepository.findByCode.mockResolvedValue(null);

      const result = await service.resolveValue('UNKNOWN', {});

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update and log audit', async () => {
      variableRepository.findById.mockResolvedValue(mockVariable as any);
      variableRepository.update.mockResolvedValue({ ...mockVariable, name: 'Updated Name' } as any);
      auditLogRepository.create.mockResolvedValue({} as any);

      const result = await service.update(mockVariable.id, { name: 'Updated Name' }, 'user-1');

      expect(result.name).toBe('Updated Name');
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'variable',
          action: 'update',
          performedBy: 'user-1',
        }),
      );
    });
  });
});
