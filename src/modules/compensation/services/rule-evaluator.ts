import { Injectable } from '@nestjs/common';
import { RuleRepository } from '../repositories/rule.repository';
import { RuleEntity } from '../entities/rule.entity';
import { RuleCondition } from '../interfaces';
import { RuleActionType } from '../enums';

export interface TeacherContext {
  schoolId: string;
  schoolLevel?: string;
  subject?: string;
  teacherType?: string;
  position?: string;
  campusId?: string;
  [key: string]: string | undefined;
}

export interface RuleMatchResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionType: RuleActionType;
  actionTarget: string;
  actionValue: string;
  priority: number;
}

@Injectable()
export class RuleEvaluator {
  constructor(private readonly ruleRepository: RuleRepository) {}

  /**
   * Evaluate all active rules for a school against a teacher context.
   * Returns matched rules sorted by priority (highest first).
   */
  async evaluate(
    schoolId: string,
    context: TeacherContext,
  ): Promise<RuleMatchResult[]> {
    const activeRules = await this.ruleRepository.findActiveBySchool(schoolId);
    const results: RuleMatchResult[] = [];

    for (const rule of activeRules) {
      const matched = this.evaluateConditions(rule.conditions, context);
      if (matched) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          matched: true,
          actionType: rule.actionType,
          actionTarget: rule.actionTarget,
          actionValue: rule.actionValue,
          priority: rule.priority,
        });
      }
    }

    // Already sorted by priority DESC from repository, but ensure it
    results.sort((a, b) => b.priority - a.priority);

    return results;
  }

  /**
   * Evaluate a single rule's conditions against context.
   */
  evaluateConditions(
    conditions: RuleCondition[],
    context: TeacherContext,
  ): boolean {
    if (conditions.length === 0) return true;

    // Process conditions with AND/OR logic
    let result = this.evaluateCondition(conditions[0], context);

    for (let i = 1; i < conditions.length; i++) {
      const prevLogicOp = conditions[i - 1].logicOp || 'AND';
      const condResult = this.evaluateCondition(conditions[i], context);

      if (prevLogicOp === 'AND') {
        result = result && condResult;
      } else {
        result = result || condResult;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition against the context.
   */
  private evaluateCondition(
    condition: RuleCondition,
    context: TeacherContext,
  ): boolean {
    const contextValue = this.getContextValue(condition.field, context);

    if (contextValue === undefined || contextValue === null) {
      // If context doesn't have the field, condition doesn't match
      return false;
    }

    const { operator, value } = condition;

    switch (operator) {
      case '==':
        return String(contextValue) === String(value);
      case '!=':
        return String(contextValue) !== String(value);
      case '>':
        return Number(contextValue) > Number(value);
      case '<':
        return Number(contextValue) < Number(value);
      case '>=':
        return Number(contextValue) >= Number(value);
      case '<=':
        return Number(contextValue) <= Number(value);
      case 'IN':
        if (Array.isArray(value)) {
          return value.includes(String(contextValue));
        }
        return false;
      case 'NOT_IN':
        if (Array.isArray(value)) {
          return !value.includes(String(contextValue));
        }
        return true;
      default:
        return false;
    }
  }

  /**
   * Map condition field names to context values.
   * Supports snake_case field names from conditions.
   */
  private getContextValue(
    field: string,
    context: TeacherContext,
  ): string | undefined {
    // Map snake_case condition fields to context keys
    const fieldMap: Record<string, string> = {
      school_level: 'schoolLevel',
      school_id: 'schoolId',
      campus_id: 'campusId',
      teacher_type: 'teacherType',
      subject: 'subject',
      position: 'position',
    };

    const contextKey = fieldMap[field] || field;
    return context[contextKey];
  }
}
