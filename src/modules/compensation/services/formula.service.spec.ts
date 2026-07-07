import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormulaService } from './formula.service';
import { FormulaRepository } from '../repositories/formula.repository';
import { PayComponentRepository } from '../repositories/pay-component.repository';
import { VariableRepository } from '../repositories/variable.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { FormulaVersionService } from './formula-version.service';
import { FormulaStatus } from '../enums';

describe('FormulaService', () => {
  let service: FormulaService;
  let formulaRepository: jest.Mocked<FormulaRepository>;
  let payComponentRepository: jest.Mocked<PayComponentRepository>;
  let variableRepository: jest.Mocked<VariableRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulaService,
        {
          provide: FormulaRepository,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
            findPublishedByPayComponent: jest.fn(),
            findPublishedBySchool: jest.fn(),
            findByPayComponentId: jest.fn(),
            getMaxVersion: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PayComponentRepository,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: VariableRepository,
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: AuditLogRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: FormulaVersionService,
          useValue: {
            recordVersion: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<FormulaService>(FormulaService);
    formulaRepository = module.get(FormulaRepository);
    payComponentRepository = module.get(PayComponentRepository);
    variableRepository = module.get(VariableRepository);
    auditLogRepository = module.get(AuditLogRepository);
  });

  describe('publish with effective dating', () => {
    const formula = {
      id: 'formula-new',
      payComponentId: 'pc-1',
      schoolId: 'school-1',
      expression: 'A + B',
      status: FormulaStatus.DRAFT,
      variableRefs: ['A', 'B'],
      dependencies: null,
    };

    beforeEach(() => {
      formulaRepository.findById.mockResolvedValue(formula as any);
      // Validation dependencies
      payComponentRepository.findAll.mockResolvedValue([[] as any, 0]);
      variableRepository.findAll.mockResolvedValue([
        [{ code: 'A' }, { code: 'B' }] as any,
        2,
      ]);
      formulaRepository.findPublishedBySchool.mockResolvedValue([]);
    });

    it('should publish formula without effective date (backward compat)', async () => {
      formulaRepository.findPublishedByPayComponent.mockResolvedValue(null);
      formulaRepository.update.mockResolvedValue({
        ...formula,
        status: FormulaStatus.PUBLISHED,
      } as any);

      const result = await service.publish('formula-new');

      expect(result.status).toBe(FormulaStatus.PUBLISHED);
      expect(formulaRepository.update).toHaveBeenCalledWith('formula-new', {
        status: FormulaStatus.PUBLISHED,
      });
    });

    it('should set effectiveFrom when provided', async () => {
      formulaRepository.findPublishedByPayComponent.mockResolvedValue(null);
      formulaRepository.update.mockResolvedValue({
        ...formula,
        status: FormulaStatus.PUBLISHED,
        effectiveFrom: '2026-07-01',
      } as any);

      const result = await service.publish('formula-new', undefined, '2026-07-01');

      expect(formulaRepository.update).toHaveBeenCalledWith('formula-new', {
        status: FormulaStatus.PUBLISHED,
        effectiveFrom: '2026-07-01',
      });
    });

    it('should auto-close previous formula effective_to when new has effectiveFrom', async () => {
      const existingPublished = {
        id: 'formula-old',
        payComponentId: 'pc-1',
        schoolId: 'school-1',
        status: FormulaStatus.PUBLISHED,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      };
      formulaRepository.findPublishedByPayComponent.mockResolvedValue(existingPublished as any);
      formulaRepository.update.mockResolvedValue({
        ...formula,
        status: FormulaStatus.PUBLISHED,
        effectiveFrom: '2026-07-01',
      } as any);

      await service.publish('formula-new', undefined, '2026-07-01');

      // Should close previous formula with effective_to = 2026-06-30
      expect(formulaRepository.update).toHaveBeenCalledWith('formula-old', {
        effectiveTo: '2026-06-30',
      });
    });

    it('should demote previous formula to DRAFT when no effective dating', async () => {
      const existingPublished = {
        id: 'formula-old',
        payComponentId: 'pc-1',
        schoolId: 'school-1',
        status: FormulaStatus.PUBLISHED,
      };
      formulaRepository.findPublishedByPayComponent.mockResolvedValue(existingPublished as any);
      formulaRepository.update.mockResolvedValue({
        ...formula,
        status: FormulaStatus.PUBLISHED,
      } as any);

      await service.publish('formula-new');

      expect(formulaRepository.update).toHaveBeenCalledWith('formula-old', {
        status: FormulaStatus.DRAFT,
      });
    });

    it('should reject publishing already-published formula', async () => {
      formulaRepository.findById.mockResolvedValue({
        ...formula,
        status: FormulaStatus.PUBLISHED,
      } as any);

      await expect(service.publish('formula-new')).rejects.toThrow(
        'Công thức đã được publish',
      );
    });
  });
});
