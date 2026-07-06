import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FormulaService } from '../../../src/modules/compensation/services/formula.service';
import { FormulaRepository } from '../../../src/modules/compensation/repositories/formula.repository';
import { PayComponentRepository } from '../../../src/modules/compensation/repositories/pay-component.repository';
import { VariableRepository } from '../../../src/modules/compensation/repositories/variable.repository';
import { AuditLogRepository } from '../../../src/modules/compensation/repositories/audit-log.repository';
import { FormulaStatus } from '../../../src/modules/compensation/enums';

describe('FormulaService', () => {
  let service: FormulaService;
  let formulaRepository: jest.Mocked<FormulaRepository>;
  let payComponentRepository: jest.Mocked<PayComponentRepository>;
  let variableRepository: jest.Mocked<VariableRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  const mockFormula = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    payComponentId: 'pc-1',
    schoolId: 'school-1',
    expression: 'BASIC_SALARY * WORKING_DAYS / STANDARD_DAYS',
    parsedAst: { type: 'BinaryExpression' },
    dependencies: ['BASIC_SALARY'],
    variableRefs: ['WORKING_DAYS', 'STANDARD_DAYS'],
    version: 1,
    changelog: 'Version 1 created',
    status: FormulaStatus.DRAFT,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockFormulaRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByPayComponentId: jest.fn(),
      findLatestByPayComponent: jest.fn(),
      findPublishedByPayComponent: jest.fn(),
      findPublishedBySchool: jest.fn(),
      findByVariableRef: jest.fn(),
      findByDependency: jest.fn(),
      getMaxVersion: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockPayComponentRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findByIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

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
        FormulaService,
        { provide: FormulaRepository, useValue: mockFormulaRepo },
        { provide: PayComponentRepository, useValue: mockPayComponentRepo },
        { provide: VariableRepository, useValue: mockVariableRepo },
        { provide: AuditLogRepository, useValue: mockAuditLogRepo },
      ],
    }).compile();

    service = module.get<FormulaService>(FormulaService);
    formulaRepository = module.get(FormulaRepository);
    payComponentRepository = module.get(PayComponentRepository);
    variableRepository = module.get(VariableRepository);
    auditLogRepository = module.get(AuditLogRepository);
  });

  describe('findById', () => {
    it('should return formula by id', async () => {
      formulaRepository.findById.mockResolvedValue(mockFormula as any);
      const result = await service.findById(mockFormula.id);
      expect(result.expression).toBe(
        'BASIC_SALARY * WORKING_DAYS / STANDARD_DAYS',
      );
    });

    it('should throw NotFoundException', async () => {
      formulaRepository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create formula with valid expression', async () => {
      payComponentRepository.findAll.mockResolvedValue([
        [{ code: 'BASIC_SALARY' }] as any,
        1,
      ]);
      variableRepository.findAll.mockResolvedValue([
        [{ code: 'WORKING_DAYS' }, { code: 'STANDARD_DAYS' }] as any,
        2,
      ]);
      formulaRepository.getMaxVersion.mockResolvedValue(0);
      formulaRepository.create.mockResolvedValue(mockFormula as any);

      const result = await service.create({
        payComponentId: 'pc-1',
        schoolId: 'school-1',
        expression: 'BASIC_SALARY * WORKING_DAYS / STANDARD_DAYS',
      });

      expect(result.expression).toBe(
        'BASIC_SALARY * WORKING_DAYS / STANDARD_DAYS',
      );
      expect(formulaRepository.create).toHaveBeenCalled();
    });

    it('should reject invalid expression', async () => {
      await expect(
        service.create({
          payComponentId: 'pc-1',
          schoolId: 'school-1',
          expression: 'BASIC_SALARY +',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish', () => {
    it('should publish a draft formula', async () => {
      const draftFormula = { ...mockFormula, status: FormulaStatus.DRAFT };
      formulaRepository.findById.mockResolvedValue(draftFormula as any);
      payComponentRepository.findAll.mockResolvedValue([
        [{ code: 'BASIC_SALARY' }] as any,
        1,
      ]);
      variableRepository.findAll.mockResolvedValue([
        [{ code: 'WORKING_DAYS' }, { code: 'STANDARD_DAYS' }] as any,
        2,
      ]);
      formulaRepository.findPublishedBySchool.mockResolvedValue([]);
      formulaRepository.findPublishedByPayComponent.mockResolvedValue(null);
      payComponentRepository.findById.mockResolvedValue({
        id: 'pc-1',
        code: 'NET_SALARY',
      } as any);
      formulaRepository.update.mockResolvedValue({
        ...draftFormula,
        status: FormulaStatus.PUBLISHED,
      } as any);

      const result = await service.publish(mockFormula.id);
      expect(result.status).toBe(FormulaStatus.PUBLISHED);
    });

    it('should reject publishing already published formula', async () => {
      const publishedFormula = {
        ...mockFormula,
        status: FormulaStatus.PUBLISHED,
      };
      formulaRepository.findById.mockResolvedValue(publishedFormula as any);

      await expect(service.publish(mockFormula.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validate', () => {
    it('should validate a correct expression', async () => {
      payComponentRepository.findAll.mockResolvedValue([
        [{ code: 'BASIC_SALARY' }] as any,
        1,
      ]);
      variableRepository.findAll.mockResolvedValue([
        [{ code: 'RATE' }] as any,
        1,
      ]);

      const result = await service.validate({
        expression: 'BASIC_SALARY * RATE',
        schoolId: 'school-1',
      });

      expect(result.valid).toBe(true);
      expect(result.prettyPrint).toBe('BASIC_SALARY * RATE');
    });

    it('should report errors for invalid expression', async () => {
      const result = await service.validate({
        expression: 'a + +',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('rollback', () => {
    it('should create new version with old content', async () => {
      const version1 = { ...mockFormula, version: 1, expression: 'A + B' };
      const version2 = {
        ...mockFormula,
        id: 'formula-v2',
        version: 2,
        expression: 'A * B',
      };

      formulaRepository.findById.mockResolvedValue(version2 as any);
      formulaRepository.findByPayComponentId.mockResolvedValue([
        version2,
        version1,
      ] as any);
      formulaRepository.getMaxVersion.mockResolvedValue(2);
      formulaRepository.create.mockResolvedValue({
        ...version1,
        id: 'formula-v3',
        version: 3,
        changelog: 'Rollback from version 1',
      } as any);

      const result = await service.rollback(version2.id, 1);

      expect(result.version).toBe(3);
      expect(result.changelog).toContain('Rollback from version 1');
    });
  });
});
