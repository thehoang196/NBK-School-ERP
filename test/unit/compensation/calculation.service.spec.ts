import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CalculationService, TeacherData } from '../../../src/modules/compensation/services/calculation.service';
import { FormulaRepository } from '../../../src/modules/compensation/repositories/formula.repository';
import { PayComponentRepository } from '../../../src/modules/compensation/repositories/pay-component.repository';
import { SalarySlipRepository } from '../../../src/modules/compensation/repositories/salary-slip.repository';
import { VariableService } from '../../../src/modules/compensation/services/variable.service';
import { RuleEvaluator } from '../../../src/modules/compensation/services/rule-evaluator';
import { DependencyGraphService } from '../../../src/modules/compensation/services/dependency-graph.service';
import { PayPeriodService } from '../../../src/modules/compensation/services/pay-period.service';
import { PolicyService } from '../../../src/modules/compensation/services/policy.service';
import { PayPeriodStatus, PayComponentType, FormulaStatus } from '../../../src/modules/compensation/enums';
import { EntityStatus } from '../../../src/common/enums/status.enum';

describe('CalculationService', () => {
  let service: CalculationService;
  let formulaRepository: jest.Mocked<FormulaRepository>;
  let payComponentRepository: jest.Mocked<PayComponentRepository>;
  let salarySlipRepository: jest.Mocked<SalarySlipRepository>;
  let variableService: jest.Mocked<VariableService>;
  let ruleEvaluator: jest.Mocked<RuleEvaluator>;
  let payPeriodService: jest.Mocked<PayPeriodService>;

  const mockPayPeriod = {
    id: 'pp-1',
    schoolId: 'school-1',
    name: 'Tháng 01/2026',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    status: PayPeriodStatus.OPEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockPayComponents = [
    {
      id: 'pc-1',
      schoolId: 'school-1',
      code: 'BASIC_SALARY',
      name: 'Lương cơ bản',
      type: PayComponentType.EARNING,
      sortOrder: 1,
      isTaxable: true,
      isInsuranceApplicable: true,
      isStatutory: false,
      status: EntityStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    {
      id: 'pc-2',
      schoolId: 'school-1',
      code: 'TAX',
      name: 'Thuế TNCN',
      type: PayComponentType.DEDUCTION,
      sortOrder: 2,
      isTaxable: false,
      isInsuranceApplicable: false,
      isStatutory: true,
      status: EntityStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  ];

  const mockFormulas = [
    {
      id: 'f-1',
      payComponentId: 'pc-1',
      schoolId: 'school-1',
      expression: 'LESSON_RATE * TEACHING_HOURS',
      parsedAst: null,
      dependencies: null,
      variableRefs: ['LESSON_RATE', 'TEACHING_HOURS'],
      version: 1,
      changelog: null,
      status: FormulaStatus.PUBLISHED,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    {
      id: 'f-2',
      payComponentId: 'pc-2',
      schoolId: 'school-1',
      expression: 'BASIC_SALARY * TAX_RATE',
      parsedAst: null,
      dependencies: ['BASIC_SALARY'],
      variableRefs: ['TAX_RATE'],
      version: 1,
      changelog: null,
      status: FormulaStatus.PUBLISHED,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculationService,
        DependencyGraphService,
        {
          provide: FormulaRepository,
          useValue: {
            findPublishedBySchool: jest.fn(),
          },
        },
        {
          provide: PayComponentRepository,
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: SalarySlipRepository,
          useValue: {
            create: jest.fn(),
            deleteDraftByTeacherAndPeriod: jest.fn(),
          },
        },
        {
          provide: VariableService,
          useValue: {
            resolveValue: jest.fn(),
          },
        },
        {
          provide: RuleEvaluator,
          useValue: {
            evaluate: jest.fn(),
          },
        },
        {
          provide: PayPeriodService,
          useValue: {
            findById: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: PolicyService,
          useValue: {
            resolvePolicy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CalculationService>(CalculationService);
    formulaRepository = module.get(FormulaRepository);
    payComponentRepository = module.get(PayComponentRepository);
    salarySlipRepository = module.get(SalarySlipRepository);
    variableService = module.get(VariableService);
    ruleEvaluator = module.get(RuleEvaluator);
    payPeriodService = module.get(PayPeriodService);
  });

  describe('calculate', () => {
    it('should reject calculation for closed pay period', async () => {
      const closedPeriod = { ...mockPayPeriod, status: PayPeriodStatus.CLOSED };
      payPeriodService.findById.mockResolvedValue(closedPeriod as never);

      await expect(
        service.calculate(
          { schoolId: 'school-1', payPeriodId: 'pp-1' },
          [],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject calculation when no published formulas', async () => {
      payPeriodService.findById.mockResolvedValue(mockPayPeriod as never);
      payPeriodService.updateStatus.mockResolvedValue(undefined as never);
      formulaRepository.findPublishedBySchool.mockResolvedValue([]);

      await expect(
        service.calculate(
          { schoolId: 'school-1', payPeriodId: 'pp-1' },
          [],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate salary for teachers successfully', async () => {
      payPeriodService.findById.mockResolvedValue(mockPayPeriod as never);
      payPeriodService.updateStatus.mockResolvedValue(undefined as never);
      formulaRepository.findPublishedBySchool.mockResolvedValue(mockFormulas as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([]);
      variableService.resolveValue.mockImplementation(async (code: string) => {
        const values: Record<string, string> = {
          LESSON_RATE: '300000',
          TEACHING_HOURS: '40',
          TAX_RATE: '0.1',
        };
        return values[code] || null;
      });
      salarySlipRepository.deleteDraftByTeacherAndPeriod.mockResolvedValue(undefined);
      salarySlipRepository.create.mockImplementation(async (data) => ({
        id: 'slip-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as never));

      const teachers: TeacherData[] = [
        { id: 'teacher-1', schoolId: 'school-1' },
      ];

      const result = await service.calculate(
        { schoolId: 'school-1', payPeriodId: 'pp-1' },
        teachers,
      );

      expect(result.totalTeachers).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.totalGross).toBeGreaterThan(0);
    });

    it('should continue calculating other teachers when one fails', async () => {
      payPeriodService.findById.mockResolvedValue(mockPayPeriod as never);
      payPeriodService.updateStatus.mockResolvedValue(undefined as never);
      formulaRepository.findPublishedBySchool.mockResolvedValue(mockFormulas as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([]);

      // First teacher will fail (missing variable), second succeeds
      let callCount = 0;
      variableService.resolveValue.mockImplementation(async (code: string) => {
        callCount++;
        if (callCount <= 3) {
          // First teacher calls — return null for first variable to cause issues
          return null;
        }
        const values: Record<string, string> = {
          LESSON_RATE: '300000',
          TEACHING_HOURS: '40',
          TAX_RATE: '0.1',
        };
        return values[code] || '0';
      });
      salarySlipRepository.deleteDraftByTeacherAndPeriod.mockResolvedValue(undefined);
      salarySlipRepository.create.mockImplementation(async (data) => ({
        id: 'slip-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as never));

      const teachers: TeacherData[] = [
        { id: 'teacher-1', schoolId: 'school-1' },
        { id: 'teacher-2', schoolId: 'school-1' },
      ];

      const result = await service.calculate(
        { schoolId: 'school-1', payPeriodId: 'pp-1' },
        teachers,
      );

      // Both should produce slips (even with 0 values when vars are null)
      expect(result.totalTeachers).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it('should be idempotent - deletes existing drafts before creating new ones', async () => {
      payPeriodService.findById.mockResolvedValue(mockPayPeriod as never);
      payPeriodService.updateStatus.mockResolvedValue(undefined as never);
      formulaRepository.findPublishedBySchool.mockResolvedValue(mockFormulas as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([]);
      variableService.resolveValue.mockResolvedValue('100');
      salarySlipRepository.deleteDraftByTeacherAndPeriod.mockResolvedValue(undefined);
      salarySlipRepository.create.mockImplementation(async (data) => ({
        id: 'slip-new',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as never));

      const teachers: TeacherData[] = [
        { id: 'teacher-1', schoolId: 'school-1' },
      ];

      await service.calculate({ schoolId: 'school-1', payPeriodId: 'pp-1' }, teachers);

      expect(salarySlipRepository.deleteDraftByTeacherAndPeriod).toHaveBeenCalledWith(
        'teacher-1',
        'pp-1',
      );
    });
  });
});
