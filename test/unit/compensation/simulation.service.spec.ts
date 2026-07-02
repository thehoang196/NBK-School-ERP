import { Test, TestingModule } from '@nestjs/testing';
import { SimulationService } from '../../../src/modules/compensation/services/simulation.service';
import { FormulaRepository } from '../../../src/modules/compensation/repositories/formula.repository';
import { PayComponentRepository } from '../../../src/modules/compensation/repositories/pay-component.repository';
import { VariableService } from '../../../src/modules/compensation/services/variable.service';
import { RuleEvaluator } from '../../../src/modules/compensation/services/rule-evaluator';
import { DependencyGraphService } from '../../../src/modules/compensation/services/dependency-graph.service';
import { PayComponentType, FormulaStatus, RuleActionType } from '../../../src/modules/compensation/enums';
import { EntityStatus } from '../../../src/common/enums/status.enum';

describe('SimulationService', () => {
  let service: SimulationService;
  let formulaRepository: jest.Mocked<FormulaRepository>;
  let payComponentRepository: jest.Mocked<PayComponentRepository>;
  let variableService: jest.Mocked<VariableService>;
  let ruleEvaluator: jest.Mocked<RuleEvaluator>;

  const mockPayComponents = [
    {
      id: 'pc-1',
      schoolId: 'school-1',
      code: 'BASIC_SALARY',
      name: 'Lương cơ bản',
      type: PayComponentType.EARNING,
      sortOrder: 1,
      isTaxable: true,
      isInsuranceApplicable: false,
      isStatutory: false,
      status: EntityStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    {
      id: 'pc-2',
      schoolId: 'school-1',
      code: 'BHXH',
      name: 'Bảo hiểm xã hội',
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
      expression: 'LESSON_RATE * HOURS',
      parsedAst: null,
      dependencies: null,
      variableRefs: ['LESSON_RATE', 'HOURS'],
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
      expression: 'BASIC_SALARY * BHXH_RATE',
      parsedAst: null,
      dependencies: ['BASIC_SALARY'],
      variableRefs: ['BHXH_RATE'],
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
        SimulationService,
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
      ],
    }).compile();

    service = module.get<SimulationService>(SimulationService);
    formulaRepository = module.get(FormulaRepository);
    payComponentRepository = module.get(PayComponentRepository);
    variableService = module.get(VariableService);
    ruleEvaluator = module.get(RuleEvaluator);
  });

  describe('simulate', () => {
    it('should return detailed simulation result without persisting', async () => {
      formulaRepository.findPublishedBySchool.mockResolvedValue(mockFormulas as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([]);
      variableService.resolveValue.mockImplementation(async (code: string) => {
        const values: Record<string, string> = {
          LESSON_RATE: '300000',
          HOURS: '40',
          BHXH_RATE: '0.08',
        };
        return values[code] || null;
      });

      const result = await service.simulate({
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        payPeriodId: 'pp-1',
      });

      expect(result.teacherId).toBe('teacher-1');
      expect(result.components).toHaveLength(2);
      expect(result.grossAmount).toBe(12000000); // 300000 * 40
      expect(result.totalDeductions).toBe(960000); // 12000000 * 0.08
      expect(result.netAmount).toBe(11040000);
      expect(result.errors).toHaveLength(0);
    });

    it('should apply variable overrides', async () => {
      formulaRepository.findPublishedBySchool.mockResolvedValue(mockFormulas as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([]);
      variableService.resolveValue.mockImplementation(async (code: string) => {
        const values: Record<string, string> = {
          LESSON_RATE: '300000',
          HOURS: '40',
          BHXH_RATE: '0.08',
        };
        return values[code] || null;
      });

      const result = await service.simulate({
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        payPeriodId: 'pp-1',
        variableOverrides: { LESSON_RATE: 350000 },
      });

      expect(result.grossAmount).toBe(14000000); // 350000 * 40 (override)
      expect(result.totalDeductions).toBe(1120000); // 14000000 * 0.08
    });

    it('should apply rule results to variables', async () => {
      formulaRepository.findPublishedBySchool.mockResolvedValue(mockFormulas as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([
        {
          ruleId: 'rule-1',
          ruleName: 'GV IELTS Rate',
          matched: true,
          actionType: RuleActionType.SET_VARIABLE,
          actionTarget: 'LESSON_RATE',
          actionValue: '500000',
          priority: 10,
        },
      ]);
      variableService.resolveValue.mockImplementation(async (code: string) => {
        const values: Record<string, string> = {
          LESSON_RATE: '300000', // This will be overridden by rule
          HOURS: '40',
          BHXH_RATE: '0.08',
        };
        return values[code] || null;
      });

      const result = await service.simulate({
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        payPeriodId: 'pp-1',
      });

      // Rule sets LESSON_RATE = 500000
      expect(result.grossAmount).toBe(20000000); // 500000 * 40
      expect(result.ruleResults).toHaveLength(1);
      expect(result.ruleResults[0].ruleName).toBe('GV IELTS Rate');
    });

    it('should report component-level errors without crashing', async () => {
      // Formula with division by zero
      const badFormula = {
        ...mockFormulas[0],
        expression: 'LESSON_RATE / 0',
        variableRefs: ['LESSON_RATE'],
      };
      formulaRepository.findPublishedBySchool.mockResolvedValue([badFormula, mockFormulas[1]] as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([]);
      variableService.resolveValue.mockImplementation(async (code: string) => {
        const values: Record<string, string> = {
          LESSON_RATE: '300000',
          BHXH_RATE: '0.08',
        };
        return values[code] || null;
      });

      const result = await service.simulate({
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        payPeriodId: 'pp-1',
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].component).toBe('BASIC_SALARY');
      expect(result.errors[0].step).toBe('formula_evaluation');
    });

    it('should provide detailed breakdown per component', async () => {
      formulaRepository.findPublishedBySchool.mockResolvedValue(mockFormulas as never);
      payComponentRepository.findAll.mockResolvedValue([mockPayComponents, 2] as never);
      ruleEvaluator.evaluate.mockResolvedValue([]);
      variableService.resolveValue.mockResolvedValue('100');

      const result = await service.simulate({
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        payPeriodId: 'pp-1',
      });

      for (const comp of result.components) {
        expect(comp.payComponentCode).toBeDefined();
        expect(comp.payComponentName).toBeDefined();
        expect(comp.formula).toBeDefined();
        expect(comp.variablesUsed).toBeDefined();
        expect(comp.type).toBeDefined();
      }
    });
  });
});
