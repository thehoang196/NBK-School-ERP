import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { FormulaRepository } from '../repositories/formula.repository';
import { PayComponentRepository } from '../repositories/pay-component.repository';
import { SalarySlipRepository } from '../repositories/salary-slip.repository';
import { VariableService } from './variable.service';
import {
  RuleEvaluator,
  TeacherContext,
  RuleMatchResult,
} from './rule-evaluator';
import { DependencyGraphService } from './dependency-graph.service';
import { PayPeriodService } from './pay-period.service';
import { PolicyService } from './policy.service';
import { TeachingMetricsService } from './teaching-metrics.service';
import { AttendanceVariableResolverService } from './attendance-variable-resolver.service';
import { PayComponentEntity } from '../entities/pay-component.entity';
import { FormulaEntity } from '../entities/formula.entity';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { PayPeriodStatus, PayComponentType, SalarySlipStatus } from '../enums';
import { RuleActionType } from '../enums';
import {
  SalarySlipItem,
  CalculationSnapshot,
  CalculationError,
} from '../interfaces';
import { Evaluator, Parser, EvaluationError } from '../formula-engine';
import { getFunctionImplementations } from '../formula-engine/function-library';

export interface CalculationRequest {
  schoolId: string;
  payPeriodId: string;
  teacherIds?: string[];
}

export interface CalculationSummary {
  totalTeachers: number;
  successCount: number;
  errorCount: number;
  totalGross: number;
  totalNet: number;
  errors: { teacherId: string; message: string }[];
}

export interface TeacherData {
  id: string;
  schoolId: string;
  schoolLevel?: string;
  campusId?: string;
  teacherType?: string;
  position?: string;
  subject?: string;
}

@Injectable()
export class CalculationService {
  private readonly logger = new Logger(CalculationService.name);

  constructor(
    private readonly formulaRepository: FormulaRepository,
    private readonly payComponentRepository: PayComponentRepository,
    private readonly salarySlipRepository: SalarySlipRepository,
    private readonly variableService: VariableService,
    private readonly ruleEvaluator: RuleEvaluator,
    private readonly dependencyGraphService: DependencyGraphService,
    private readonly payPeriodService: PayPeriodService,
    private readonly policyService: PolicyService,
    private readonly teachingMetricsService: TeachingMetricsService,
    private readonly attendanceResolver: AttendanceVariableResolverService,
  ) {}

  /**
   * Main calculation orchestrator.
   * Idempotent: same input → same output. Overwrites DRAFT slips for same period.
   */
  async calculate(
    request: CalculationRequest,
    teacherDataList: TeacherData[],
  ): Promise<CalculationSummary> {
    const { schoolId, payPeriodId } = request;

    // 1. Validate pay period
    const payPeriod = await this.payPeriodService.findById(payPeriodId);
    if (payPeriod.status === PayPeriodStatus.CLOSED) {
      throw new BadRequestException('Kỳ lương đã đóng, không thể tính lại');
    }

    // Update status to PROCESSING
    await this.payPeriodService.updateStatus(
      payPeriodId,
      PayPeriodStatus.PROCESSING,
    );

    // 2. Get all published formulas for the school (with effective dating)
    const formulas =
      await this.formulaRepository.findPublishedBySchoolAndDate(
        schoolId,
        payPeriod.startDate,
      );
    if (formulas.length === 0) {
      throw new BadRequestException(
        'Không có công thức nào đã publish cho trường này',
      );
    }

    // 3. Build dependency graph and topological sort
    const [payComponents] = await this.payComponentRepository.findAll({
      page: 1,
      limit: 1000,
      sortOrder: 'ASC',
      schoolId,
    });

    const codeMap = new Map<string, string>(); // payComponentId → code
    const componentMap = new Map<string, PayComponentEntity>(); // code → entity
    for (const pc of payComponents) {
      codeMap.set(pc.id, pc.code);
      componentMap.set(pc.code, pc);
    }

    const graph = this.dependencyGraphService.buildGraph(formulas, codeMap);
    const sortResult = this.dependencyGraphService.topologicalSort(graph);

    if (sortResult.hasCycle) {
      throw new BadRequestException(
        `Phát hiện tham chiếu vòng: ${sortResult.cyclePaths.join('; ')}`,
      );
    }

    // Map formula by pay component code
    const formulaByCode = new Map<string, FormulaEntity>();
    for (const formula of formulas) {
      const code = codeMap.get(formula.payComponentId);
      if (code) {
        formulaByCode.set(code, formula);
      }
    }

    // 4. Calculate for each teacher
    const summary: CalculationSummary = {
      totalTeachers: teacherDataList.length,
      successCount: 0,
      errorCount: 0,
      totalGross: 0,
      totalNet: 0,
      errors: [],
    };

    for (const teacher of teacherDataList) {
      try {
        const slip = await this.calculateForTeacher(
          teacher,
          payPeriodId,
          schoolId,
          payPeriod.startDate,
          sortResult.order,
          formulaByCode,
          componentMap,
        );

        summary.successCount++;
        summary.totalGross += Number(slip.grossAmount);
        summary.totalNet += Number(slip.netAmount);
      } catch (error) {
        summary.errorCount++;
        summary.errors.push({
          teacherId: teacher.id,
          message: (error as Error).message,
        });
        this.logger.warn(
          `Lỗi tính lương cho GV ${teacher.id}: ${(error as Error).message}`,
        );
      }
    }

    // 5. Revert pay period status if all errored; otherwise keep PROCESSING for review
    if (summary.successCount === 0 && summary.errorCount > 0) {
      await this.payPeriodService.updateStatus(
        payPeriodId,
        PayPeriodStatus.OPEN,
      );
    }

    return summary;
  }

  /**
   * Calculate salary for a single teacher. Creates or updates DRAFT salary slip.
   */
  private async calculateForTeacher(
    teacher: TeacherData,
    payPeriodId: string,
    schoolId: string,
    periodStartDate: string,
    calculationOrder: string[],
    formulaByCode: Map<string, FormulaEntity>,
    componentMap: Map<string, PayComponentEntity>,
  ): Promise<SalarySlipEntity> {
    const calcErrors: CalculationError[] = [];

    // Step A: Resolve variables
    const variableValues: Record<string, number> = {};
    const context: TeacherContext = {
      schoolId: teacher.schoolId,
      schoolLevel: teacher.schoolLevel,
      campusId: teacher.campusId,
      teacherType: teacher.teacherType,
      position: teacher.position,
      subject: teacher.subject,
    };

    // Step A.1: Auto-resolve attendance variables (NGAY_CONG, CONG_CHUAN, etc.)
    try {
      const startDate = new Date(periodStartDate);
      const month = startDate.getMonth() + 1;
      const year = startDate.getFullYear();
      const attendanceVars = await this.attendanceResolver.resolve(
        teacher.id,
        schoolId,
        month,
        year,
      );
      Object.assign(variableValues, attendanceVars);
    } catch (error) {
      this.logger.warn(
        `Không thể resolve biến chấm công cho GV ${teacher.id}: ${(error as Error).message}`,
      );
    }

    // Step A.2: Auto-resolve teaching metrics (TEACHING_HOURS, etc.)
    try {
      const endDate = this.getEndDateFromStart(periodStartDate);
      const totalHours = await this.teachingMetricsService.getTotalTeachingHours(
        teacher.id,
        schoolId,
        periodStartDate,
        endDate,
      );
      if (totalHours > 0) {
        variableValues['TEACHING_HOURS'] = totalHours;
      }
    } catch (error) {
      this.logger.warn(
        `Không thể resolve biến tiết dạy cho GV ${teacher.id}: ${(error as Error).message}`,
      );
    }

    // Step B: Evaluate rules
    const ruleResults = await this.ruleEvaluator.evaluate(schoolId, context);
    const ruleSnapshotResults = ruleResults.map((r) => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      matched: r.matched,
      action: `${r.actionType}: ${r.actionTarget} = ${r.actionValue}`,
    }));

    // Apply rule results to variable overrides
    for (const rule of ruleResults) {
      if (rule.actionType === RuleActionType.SET_VARIABLE) {
        variableValues[rule.actionTarget] = parseFloat(rule.actionValue) || 0;
      } else if (rule.actionType === RuleActionType.SET_COEFFICIENT) {
        variableValues[rule.actionTarget] = parseFloat(rule.actionValue) || 1;
      }
    }

    // Step C: Resolve remaining variables from Variable Manager
    for (const code of calculationOrder) {
      const formula = formulaByCode.get(code);
      if (!formula || !formula.variableRefs) continue;

      for (const varCode of formula.variableRefs) {
        if (variableValues[varCode] === undefined) {
          const value = await this.variableService.resolveValue(varCode, {
            schoolId,
            schoolLevel: teacher.schoolLevel,
          });
          variableValues[varCode] = value !== null ? parseFloat(value) || 0 : 0;
        }
      }
    }

    // Step D: Calculate each Pay Component in dependency order
    const calculatedValues: Record<string, number> = {};
    const earnings: SalarySlipItem[] = [];
    const deductions: SalarySlipItem[] = [];
    const functions = getFunctionImplementations();

    for (const code of calculationOrder) {
      const formula = formulaByCode.get(code);
      const component = componentMap.get(code);
      if (!formula || !component) continue;

      try {
        // Merge variable values and previously calculated component values
        const evalVariables: Record<string, number> = {
          ...variableValues,
          ...calculatedValues,
        };

        const parser = new Parser(formula.expression);
        const ast = parser.parse();
        const evaluator = new Evaluator({
          variables: evalVariables,
          functions,
        });
        const result = evaluator.evaluate(ast);

        calculatedValues[code] = result;

        const item: SalarySlipItem = {
          payComponentId: component.id,
          payComponentCode: code,
          payComponentName: component.name,
          formula: formula.expression,
          amount: Math.round(result * 100) / 100,
        };

        if (component.type === PayComponentType.EARNING) {
          earnings.push(item);
        } else {
          deductions.push(item);
        }
      } catch (error) {
        calcErrors.push({
          payComponentCode: code,
          error: (error as Error).message,
          step: 'formula_evaluation',
        });
      }
    }

    // Step E: Build salary slip
    const grossAmount = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netAmount = grossAmount - totalDeductions;

    const snapshot: CalculationSnapshot = {
      variables: variableValues as Record<string, string | number | boolean>,
      ruleResults: ruleSnapshotResults,
    };

    // Idempotent: remove existing DRAFT slip for same teacher + period
    await this.salarySlipRepository.deleteDraftByTeacherAndPeriod(
      teacher.id,
      payPeriodId,
    );

    // Create new salary slip
    const slip = await this.salarySlipRepository.create({
      teacherId: teacher.id,
      schoolId,
      payPeriodId,
      earnings,
      deductions,
      grossAmount,
      totalDeductions,
      netAmount,
      snapshot,
      status:
        calcErrors.length > 0 ? SalarySlipStatus.DRAFT : SalarySlipStatus.DRAFT,
      errors: calcErrors.length > 0 ? calcErrors : null,
    });

    return slip;
  }

  /**
   * Get end date of the month from a start date string (YYYY-MM-DD).
   */
  private getEndDateFromStart(startDate: string): string {
    const date = new Date(startDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
}
