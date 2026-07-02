export enum PayComponentType {
  EARNING = 'earning',
  DEDUCTION = 'deduction',
}

export enum FormulaStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum RuleActionType {
  SET_VARIABLE = 'set_variable',
  SET_COEFFICIENT = 'set_coefficient',
}

export enum VariableDataType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
}

export enum VariableScope {
  SYSTEM = 'system',
  SCHOOL = 'school',
  SCHOOL_LEVEL = 'school_level',
}

export enum SalarySlipStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  PAID = 'paid',
}

export enum PayPeriodStatus {
  OPEN = 'open',
  PROCESSING = 'processing',
  CLOSED = 'closed',
}
