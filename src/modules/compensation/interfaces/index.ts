export interface RuleCondition {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT_IN';
  value: string | number | string[];
  logicOp?: 'AND' | 'OR';
}

export interface SalarySlipItem {
  payComponentId: string;
  payComponentCode: string;
  payComponentName: string;
  formula: string;
  amount: number;
}

export interface CalculationSnapshot {
  variables: Record<string, string | number | boolean>;
  ruleResults: { ruleId: string; ruleName: string; matched: boolean; action?: string }[];
}

export interface CalculationError {
  payComponentCode: string;
  error: string;
  step: string;
}
