import { Injectable, Logger } from '@nestjs/common';
import { FormulaRepository } from '../repositories/formula.repository';
import { PayComponentRepository } from '../repositories/pay-component.repository';
import { VariableService } from './variable.service';
import { RuleEvaluator, TeacherContext } from './rule-evaluator';
import { DependencyGraphService } from './dependency-graph.service';
import { PayComponentEntity } from '../entities/pay-component.entity';
import { FormulaEntity } from '../entities/formula.entity';
import { RuleActionType, PayComponentType } from '../enums';
import { Evaluator, Parser, EvaluationError } from '../formula-engine';
import { getFunctionImplementations } from '../formula-engine/function-library';

export interface SimulationRequest {
  teacherId: string;
  schoolId: string;
  payPeriodId: string;
  variableOverrides?: Record<string, number>;
  teacherContext?: TeacherContext;
}

export interface SimulationComponentResult {
  payComponentCode: string;
  payComponentName: string;
  type: string;
  formula: string;
  variablesUsed: Record<string, number>;
  rulesMatched: string[];
  result: number | null;
  error: string | null;
}

export interface SimulationResult {
  teacherId: string;
  payPeriodId: string;
  components: SimulationComponentResult[];
  earnings: { code: string; name: string; amount: number }[];
  deductions: { code: string; name: string; amount: number }[];
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  variables: Record<string, number>;
  ruleResults: { ruleId: string; ruleName: string; action: string }[];
  errors: { component: string; step: string; message: string }[];
}

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    private readonly formulaRepository: FormulaRepository,
    private readonly payComponentRepository: PayComponentRepository,
    private readonly variableService: VariableService,
    private readonly ruleEvaluator: RuleEvaluator,
    private readonly dependencyGraphService: DependencyGraphService,
  ) {}

  /**
   * Simulate salary calculation for a single teacher WITHOUT persisting anything.
   * Returns detailed breakdown of each component.
   */
  async simulate(request: SimulationRequest): Promise<SimulationResult> {
    const { teacherId, schoolId, payPeriodId, variableOverrides, teacherContext } = request;

    // 1. Get published formulas
    const formulas = await this.formulaRepository.findPublishedBySchool(schoolId);

    // 2. Build dependency graph
    const [payComponents] = await this.payComponentRepository.findAll({
      page: 1,
      limit: 1000,
      sortOrder: 'ASC',
      schoolId,
    });

    const codeMap = new Map<string, string>();
    const componentMap = new Map<string, PayComponentEntity>();
    for (const pc of payComponents) {
      codeMap.set(pc.id, pc.code);
      componentMap.set(pc.code, pc);
    }

    const graph = this.dependencyGraphService.buildGraph(formulas, codeMap);
    const sortResult = this.dependencyGraphService.topologicalSort(graph);

    const formulaByCode = new Map<string, FormulaEntity>();
    for (const formula of formulas) {
      const code = codeMap.get(formula.payComponentId);
      if (code) {
        formulaByCode.set(code, formula);
      }
    }

    // 3. Evaluate rules
    const context: TeacherContext = teacherContext || {
      schoolId,
    };

    const ruleResults = await this.ruleEvaluator.evaluate(schoolId, context);
    const ruleDetails = ruleResults.map((r) => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      action: `${r.actionType}: ${r.actionTarget} = ${r.actionValue}`,
    }));

    // 4. Build variable values (rules → overrides → resolve)
    const variableValues: Record<string, number> = {};

    // Apply rule-set variables first
    for (const rule of ruleResults) {
      if (rule.actionType === RuleActionType.SET_VARIABLE) {
        variableValues[rule.actionTarget] = parseFloat(rule.actionValue) || 0;
      } else if (rule.actionType === RuleActionType.SET_COEFFICIENT) {
        variableValues[rule.actionTarget] = parseFloat(rule.actionValue) || 1;
      }
    }

    // Resolve remaining variables
    for (const code of sortResult.order) {
      const formula = formulaByCode.get(code);
      if (!formula || !formula.variableRefs) continue;

      for (const varCode of formula.variableRefs) {
        if (variableValues[varCode] === undefined) {
          const value = await this.variableService.resolveValue(varCode, {
            schoolId,
            schoolLevel: context.schoolLevel,
          });
          variableValues[varCode] = value !== null ? parseFloat(value) || 0 : 0;
        }
      }
    }

    // Apply user overrides (highest priority)
    if (variableOverrides) {
      for (const [key, val] of Object.entries(variableOverrides)) {
        variableValues[key] = val;
      }
    }

    // 5. Calculate each component with detailed tracking
    const calculatedValues: Record<string, number> = {};
    const components: SimulationComponentResult[] = [];
    const errors: { component: string; step: string; message: string }[] = [];
    const functions = getFunctionImplementations();

    for (const code of sortResult.order) {
      const formula = formulaByCode.get(code);
      const component = componentMap.get(code);
      if (!formula || !component) continue;

      const evalVariables: Record<string, number> = {
        ...variableValues,
        ...calculatedValues,
      };

      // Track which variables this formula uses
      const usedVars: Record<string, number> = {};
      for (const ref of formula.variableRefs || []) {
        if (evalVariables[ref] !== undefined) {
          usedVars[ref] = evalVariables[ref];
        }
      }
      for (const dep of formula.dependencies || []) {
        if (calculatedValues[dep] !== undefined) {
          usedVars[dep] = calculatedValues[dep];
        }
      }

      // Which rules affected variables used by this formula
      const relevantRules = ruleResults
        .filter((r) => formula.variableRefs?.includes(r.actionTarget))
        .map((r) => r.ruleName);

      let result: number | null = null;
      let error: string | null = null;

      try {
        const parser = new Parser(formula.expression);
        const ast = parser.parse();
        const evaluator = new Evaluator({ variables: evalVariables, functions });
        result = Math.round(evaluator.evaluate(ast) * 100) / 100;
        calculatedValues[code] = result;
      } catch (e) {
        error = (e as Error).message;
        errors.push({
          component: code,
          step: 'formula_evaluation',
          message: error,
        });
      }

      components.push({
        payComponentCode: code,
        payComponentName: component.name,
        type: component.type,
        formula: formula.expression,
        variablesUsed: usedVars,
        rulesMatched: relevantRules,
        result,
        error,
      });
    }

    // 6. Summarize
    const earnings = components
      .filter((c) => c.result !== null && componentMap.get(c.payComponentCode)?.type === PayComponentType.EARNING)
      .map((c) => ({ code: c.payComponentCode, name: c.payComponentName, amount: c.result! }));

    const deductions = components
      .filter((c) => c.result !== null && componentMap.get(c.payComponentCode)?.type === PayComponentType.DEDUCTION)
      .map((c) => ({ code: c.payComponentCode, name: c.payComponentName, amount: c.result! }));

    const grossAmount = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netAmount = grossAmount - totalDeductions;

    return {
      teacherId,
      payPeriodId,
      components,
      earnings,
      deductions,
      grossAmount,
      totalDeductions,
      netAmount,
      variables: variableValues,
      ruleResults: ruleDetails,
      errors,
    };
  }
}
