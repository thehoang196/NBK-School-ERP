import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ValidationRulesRepository } from './validation-rules.repository';
import {
  ValidationRuleEntity,
  ValidationRuleType,
  ValidationEntityTarget,
  RangeRuleConfig,
  RegexRuleConfig,
  EnumRuleConfig,
  ReferenceRuleConfig,
  LengthRuleConfig,
  CustomRuleConfig,
} from './entities/validation-rule.entity';
import {
  ValidationResult,
  FieldValidationError,
  EntityValidationResult,
  BatchValidationResult,
} from './interfaces/validation.interface';

@Injectable()
export class ValidationRulesService {
  private readonly logger = new Logger(ValidationRulesService.name);

  constructor(
    private readonly repository: ValidationRulesRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Validate một field đơn lẻ theo tất cả rules active cho field đó.
   */
  async validateField(
    fieldName: string,
    value: unknown,
    schoolId: string,
    entityTarget: ValidationEntityTarget,
  ): Promise<ValidationResult> {
    const rules = await this.repository.findActiveRulesForField(
      schoolId,
      entityTarget,
      fieldName,
    );

    const errors: FieldValidationError[] = [];

    for (const rule of rules) {
      const error = await this.applyRule(rule, value);
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate toàn bộ entity (tất cả fields có rules).
   */
  async validateEntity(
    data: Record<string, unknown>,
    schoolId: string,
    entityTarget: ValidationEntityTarget,
  ): Promise<EntityValidationResult> {
    const allRules = await this.repository.findActiveRules(
      schoolId,
      entityTarget,
    );

    const fieldErrors = new Map<string, FieldValidationError[]>();
    let isValid = true;

    // Group rules by field
    const rulesByField = new Map<string, ValidationRuleEntity[]>();
    for (const rule of allRules) {
      if (!rulesByField.has(rule.fieldName)) {
        rulesByField.set(rule.fieldName, []);
      }
      rulesByField.get(rule.fieldName)!.push(rule);
    }

    for (const [fieldName, rules] of rulesByField) {
      const value = data[fieldName];
      const errors: FieldValidationError[] = [];

      for (const rule of rules) {
        const error = await this.applyRule(rule, value);
        if (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        fieldErrors.set(fieldName, errors);
        isValid = false;
      }
    }

    return { isValid, fieldErrors };
  }

  /**
   * Validate nhiều rows cùng lúc (dùng cho import).
   * Pre-load rules một lần, apply cho tất cả rows.
   */
  async validateBatch(
    rows: Array<{ rowIndex: number; data: Record<string, unknown> }>,
    schoolId: string,
    entityTarget: ValidationEntityTarget,
  ): Promise<BatchValidationResult> {
    const allRules = await this.repository.findActiveRules(
      schoolId,
      entityTarget,
    );

    // Group rules by field
    const rulesByField = new Map<string, ValidationRuleEntity[]>();
    for (const rule of allRules) {
      if (!rulesByField.has(rule.fieldName)) {
        rulesByField.set(rule.fieldName, []);
      }
      rulesByField.get(rule.fieldName)!.push(rule);
    }

    const errors: Array<{
      rowIndex: number;
      fieldErrors: FieldValidationError[];
    }> = [];
    let validRows = 0;

    for (const row of rows) {
      const rowErrors: FieldValidationError[] = [];

      for (const [fieldName, rules] of rulesByField) {
        const value = row.data[fieldName];
        for (const rule of rules) {
          const error = await this.applyRule(rule, value);
          if (error) {
            rowErrors.push(error);
          }
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ rowIndex: row.rowIndex, fieldErrors: rowErrors });
      } else {
        validRows++;
      }
    }

    return {
      totalRows: rows.length,
      validRows,
      invalidRows: errors.length,
      errors,
    };
  }

  // ─── RULE APPLICATION ───────────────────────────────────────────────────

  /**
   * Apply một rule lên một value. Returns null nếu pass, error nếu fail.
   */
  private async applyRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): Promise<FieldValidationError | null> {
    switch (rule.ruleType) {
      case ValidationRuleType.REQUIRED:
        return this.applyRequiredRule(rule, value);
      case ValidationRuleType.RANGE:
        return this.applyRangeRule(rule, value);
      case ValidationRuleType.REGEX:
        return this.applyRegexRule(rule, value);
      case ValidationRuleType.ENUM:
        return this.applyEnumRule(rule, value);
      case ValidationRuleType.LENGTH:
        return this.applyLengthRule(rule, value);
      case ValidationRuleType.REFERENCE:
        return this.applyReferenceRule(rule, value);
      case ValidationRuleType.CUSTOM:
        return this.applyCustomRule(rule, value);
      default:
        this.logger.warn(`Unknown rule type: ${rule.ruleType}`);
        return null;
    }
  }

  private applyRequiredRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): FieldValidationError | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return this.buildError(rule, value);
    }
    return null;
  }

  private applyRangeRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): FieldValidationError | null {
    // Skip if value is null/undefined (use REQUIRED rule for that)
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return this.buildError(rule, value);
    }

    const config = rule.ruleConfig as RangeRuleConfig;
    if (config.min !== undefined && numValue < config.min) {
      return this.buildError(rule, value);
    }
    if (config.max !== undefined && numValue > config.max) {
      return this.buildError(rule, value);
    }

    return null;
  }

  private applyRegexRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): FieldValidationError | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    const config = rule.ruleConfig as RegexRuleConfig;
    try {
      const regex = new RegExp(config.pattern, config.flags || '');
      if (!regex.test(String(value))) {
        return this.buildError(rule, value);
      }
    } catch {
      this.logger.error(
        `Invalid regex pattern in rule ${rule.id}: ${config.pattern}`,
      );
      return null; // Don't fail on broken regex config
    }

    return null;
  }

  private applyEnumRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): FieldValidationError | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    const config = rule.ruleConfig as EnumRuleConfig;
    const strValue = String(value).trim();

    if (!config.allowedValues.includes(strValue)) {
      return this.buildError(rule, value);
    }

    return null;
  }

  private applyLengthRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): FieldValidationError | null {
    if (value === null || value === undefined) {
      return null;
    }

    const strValue = String(value);
    const config = rule.ruleConfig as LengthRuleConfig;

    if (config.min !== undefined && strValue.length < config.min) {
      return this.buildError(rule, value);
    }
    if (config.max !== undefined && strValue.length > config.max) {
      return this.buildError(rule, value);
    }

    return null;
  }

  /**
   * Validate FK reference exists in target table.
   * Uses raw query for flexibility (target table is configurable).
   */
  private async applyReferenceRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): Promise<FieldValidationError | null> {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    const config = rule.ruleConfig as ReferenceRuleConfig;

    // Whitelist allowed tables to prevent SQL injection
    const allowedTables = [
      'teachers',
      'subjects',
      'classes',
      'grades',
      'departments',
      'rooms',
      'schools',
      'academic_years',
      'semesters',
    ];
    if (!allowedTables.includes(config.targetTable)) {
      this.logger.warn(
        `Reference rule ${rule.id} targets disallowed table: ${config.targetTable}`,
      );
      return null;
    }

    // Whitelist allowed columns
    const allowedColumns = ['id', 'name', 'code', 'employee_code'];
    if (!allowedColumns.includes(config.targetColumn)) {
      this.logger.warn(
        `Reference rule ${rule.id} targets disallowed column: ${config.targetColumn}`,
      );
      return null;
    }

    let query = `SELECT 1 FROM ${config.targetTable} WHERE ${config.targetColumn} = $1 AND deleted_at IS NULL`;
    const params: unknown[] = [value];

    if (config.scopeBySchool) {
      query += ` AND school_id = $2`;
      params.push(rule.schoolId);
    }

    query += ' LIMIT 1';

    const result = await this.dataSource.query(query, params);

    if (!result || result.length === 0) {
      return this.buildError(rule, value);
    }

    return null;
  }

  /**
   * Custom rule: evaluates simple expression.
   * Supports basic comparisons only (no eval/Function for security).
   */
  private applyCustomRule(
    rule: ValidationRuleEntity,
    value: unknown,
  ): FieldValidationError | null {
    if (value === null || value === undefined) {
      return null;
    }

    const config = rule.ruleConfig as CustomRuleConfig;

    try {
      const isValid = this.evaluateExpression(config.expression, value);
      if (!isValid) {
        return this.buildError(rule, value);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      this.logger.error(`Custom rule ${rule.id} evaluation failed: ${msg}`);
      return null; // Don't fail on broken custom rules
    }

    return null;
  }

  /**
   * Simple expression evaluator (NO eval/Function usage for security).
   * Supports:
   *   - "value > 0"
   *   - "value >= 1 && value <= 50"
   *   - "value.length <= 20"
   *   - "value % 2 === 0"
   */
  private evaluateExpression(expression: string, value: unknown): boolean {
    const numValue = Number(value);
    const strValue = String(value);

    // Replace 'value' with actual value in simple patterns
    const expr = expression.trim();

    // Pattern: value {op} {number}
    const singleCompare = /^value\s*(>=|<=|>|<|===|!==|==|!=)\s*(-?\d+\.?\d*)$/;
    const match = singleCompare.exec(expr);
    if (match) {
      const op = match[1];
      const target = parseFloat(match[2]);
      return this.compareValues(numValue, op, target);
    }

    // Pattern: value {op1} {num1} && value {op2} {num2}
    const doubleCompare =
      /^value\s*(>=|<=|>|<|===|!==|==|!=)\s*(-?\d+\.?\d*)\s*&&\s*value\s*(>=|<=|>|<|===|!==|==|!=)\s*(-?\d+\.?\d*)$/;
    const doubleMatch = doubleCompare.exec(expr);
    if (doubleMatch) {
      const op1 = doubleMatch[1];
      const target1 = parseFloat(doubleMatch[2]);
      const op2 = doubleMatch[3];
      const target2 = parseFloat(doubleMatch[4]);
      return (
        this.compareValues(numValue, op1, target1) &&
        this.compareValues(numValue, op2, target2)
      );
    }

    // Pattern: value.length {op} {number}
    const lengthCompare =
      /^value\.length\s*(>=|<=|>|<|===|!==|==|!=)\s*(-?\d+)$/;
    const lengthMatch = lengthCompare.exec(expr);
    if (lengthMatch) {
      const op = lengthMatch[1];
      const target = parseInt(lengthMatch[2], 10);
      return this.compareValues(strValue.length, op, target);
    }

    // Pattern: value % {number} === {number}
    const moduloCompare = /^value\s*%\s*(\d+)\s*===\s*(\d+)$/;
    const moduloMatch = moduloCompare.exec(expr);
    if (moduloMatch) {
      const divisor = parseInt(moduloMatch[1], 10);
      const expected = parseInt(moduloMatch[2], 10);
      return numValue % divisor === expected;
    }

    // If no pattern matches, treat as invalid (fail open — don't block)
    this.logger.warn(`Cannot evaluate expression: "${expression}"`);
    return true;
  }

  private compareValues(
    actual: number,
    operator: string,
    target: number,
  ): boolean {
    switch (operator) {
      case '>':
        return actual > target;
      case '>=':
        return actual >= target;
      case '<':
        return actual < target;
      case '<=':
        return actual <= target;
      case '===':
      case '==':
        return actual === target;
      case '!==':
      case '!=':
        return actual !== target;
      default:
        return true;
    }
  }

  private buildError(
    rule: ValidationRuleEntity,
    value: unknown,
  ): FieldValidationError {
    return {
      fieldName: rule.fieldName,
      ruleType: rule.ruleType,
      message: rule.errorMessage,
      value,
    };
  }
}
