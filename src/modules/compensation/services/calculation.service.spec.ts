import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CalculationService, TeacherData } from './calculation.service';
import { FormulaRepository } from '../repositories/formula.repository';
import { PayComponentRepository } from '../repositories/pay-component.repository';
import { SalarySlipRepository } from '../repositories/salary-slip.repository';
import { VariableService } from './variable.service';
import { RuleEvaluator } from './rule-evaluator';
import { DependencyGraphService } from './dependency-graph.service';
import { PayPeriodService } from './pay-period.service';
import { PolicyService } from './policy.service';
import { TeachingMetricsService } from './teaching-metrics.service';
import { AttendanceVariableResolverService } from './attendance-variable-resolver.service';
import { PayPeriodStatus, PayComponentType, FormulaStatus } from '../enums';

describe('CalculationService', () => {
  let service: CalculationService;
  let formulaRepository: jest.Mocked<FormulaRepository>;
  let payComponentRepository: jest.Mocked<PayComponentRepository>;
  let salarySlipRepository: jest.Mocked<SalarySlipRepository>;
  let variableService: jest.Mocked<VariableService>;
  let ruleEvaluator: jest.Mocked<RuleEvaluator>;
  let dependencyGraphService: jest.Mocked<DependencyGraphService>;
  let payPeriodService: jest.Mocked<PayPeriodService>;
  let policyService: jest.Mocked<PolicyService>;
  let teachingMetricsService: jest.Mocked<TeachingMetricsService>;
  let attendanceResolver: jest.Mocked<AttendanceVariableResolverService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculationService,
        {
          provide: FormulaRepository,
          useValue: {
            findPublishedBySchool: jest.fn(),
            findPublishedBySchoolAndDate: jest.fn(),
          },
        },
        {
          provide: PayComponentRepository,
          useValue: { findAll: jest.fn() },
        },
        {
          provide: SalarySlipRepository,
          useValue: {
            deleteDraftByTeacherAndPeriod: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: VariableService,
          useValue: { resolveValue: jest.fn() },
        },
        {
          provide: RuleEvaluator,
          useValue: { evaluate: jest.fn() },
        },
        {
          provide: DependencyGraphService,
          useValue: {
            buildGraph: jest.fn(),
            topologicalSort: jest.fn(),
          },
        },
        {
          provide: PayPeriodService,
          useValue: {
            findById: jest.fn(),
            updateStatus: jest.fn().mockResolvedValue({} as any),
          },
        },
        {
          provide: PolicyService,
          useValue: {},
        },
        {
          provide: TeachingMetricsService,
          useValue: { getTotalTeachingHours: jest.fn() },
        },
        {
          provide: AttendanceVariableResolverService,
          useValue: { resolve: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CalculationService>(CalculationService);
    formulaRepository = module.get(FormulaRepository);
    payComponentRepository = module.get(PayComponentRepository);
    salarySlipRepository = module.get(SalarySlipRepository);
    variableService = module.get(VariableService);
    ruleEvaluator = module.get(RuleEvaluator);
    dependencyGraphService = module.get(DependencyGraphService);
    payPeriodService = module.get(PayPeriodService);
    policyService = module.get(PolicyService);
    teachingMetricsService = module.get(TeachingMetricsService);
    attendanceResolver = module.get(AttendanceVariableResolverService);
  });

  describe('calculate', () => {
    const schoolId = 'school-1';
    const payPeriodId = 'period-1';
    const teacher: TeacherData = {
      id: 'teacher-1',
      schoolId,
      schoolLevel: 'THPT',
    };

    beforeEach(() => {
      payPeriodService.findById.mockResolvedValue({
        id: payPeriodId,
        status: PayPeriodStatus.OPEN,
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      } as any);
      payPeriodService.updateStatus.mockResolvedValue({} as any);

      // Teaching metrics auto-resolution
      teachingMetricsService.getTotalTeachingHours.mockResolvedValue(35);

      // Attendance auto-resolution
      attendanceResolver.resolve.mockResolvedValue({
        NGAY_CONG: 22,
        CONG_CHUAN: 26,
        TANG_CA: 3,
        NGAY_NGHI_PHEP: 2,
        NGAY_NGHI_KHONG_LUONG: 0,
        NGAY_DI_MUON: 1,
        NGAY_VANG: 0,
      });
    });

    it('should reject when pay period is CLOSED', async () => {
      payPeriodService.findById.mockResolvedValue({
        id: payPeriodId,
        status: PayPeriodStatus.CLOSED,
        startDate: '2026-06-01',
      } as any);

      await expect(
        service.calculate({ schoolId, payPeriodId }, [teacher]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when no published formulas exist', async () => {
      formulaRepository.findPublishedBySchoolAndDate.mockResolvedValue([]);

      await expect(
        service.calculate({ schoolId, payPeriodId }, [teacher]),
      ).rejects.toThrow('Không có công thức nào đã publish cho trường này');
    });

    it('should auto-resolve attendance and teaching metrics before calculation', async () => {
      // Setup minimal formula
      const formulaEntity = {
        id: 'formula-1',
        payComponentId: 'pc-1',
        schoolId,
        expression: 'NGAY_CONG * 100000',
        variableRefs: ['NGAY_CONG'],
        dependencies: null,
        status: FormulaStatus.PUBLISHED,
      };
      formulaRepository.findPublishedBySchoolAndDate.mockResolvedValue([formulaEntity] as any);

      const payComponent = {
        id: 'pc-1',
        code: 'AN_CA',
        name: 'Ăn ca',
        type: PayComponentType.EARNING,
      };
      payComponentRepository.findAll.mockResolvedValue([[payComponent] as any, 1]);

      dependencyGraphService.buildGraph.mockReturnValue(new Map());
      dependencyGraphService.topologicalSort.mockReturnValue({
        order: ['AN_CA'],
        hasCycle: false,
        cyclePaths: [],
      });

      ruleEvaluator.evaluate.mockResolvedValue([]);

      salarySlipRepository.deleteDraftByTeacherAndPeriod.mockResolvedValue(undefined);
      salarySlipRepository.create.mockResolvedValue({
        id: 'slip-1',
        grossAmount: 2200000,
        netAmount: 2200000,
      } as any);

      const result = await service.calculate({ schoolId, payPeriodId }, [teacher]);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(attendanceResolver.resolve).toHaveBeenCalledWith(
        'teacher-1',
        schoolId,
        6,
        2026,
      );
      expect(teachingMetricsService.getTotalTeachingHours).toHaveBeenCalledWith(
        'teacher-1',
        schoolId,
        '2026-06-01',
        '2026-06-30',
      );
    });

    it('should use effective dating when querying formulas', async () => {
      formulaRepository.findPublishedBySchoolAndDate.mockResolvedValue([]);

      await expect(
        service.calculate({ schoolId, payPeriodId }, [teacher]),
      ).rejects.toThrow();

      expect(formulaRepository.findPublishedBySchoolAndDate).toHaveBeenCalledWith(
        schoolId,
        '2026-06-01',
      );
    });
  });
});
