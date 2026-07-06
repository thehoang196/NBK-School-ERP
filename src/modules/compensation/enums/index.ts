export { PayrollRunStatus } from './payroll-run-status.enum';
export { ApprovalAction } from './approval-action.enum';

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

/**
 * Loại tiết dạy — dùng để phân loại tiết theo hệ số lương NBK.
 * Mapping từ subject/activity → type được cấu hình qua Rule Engine hoặc subject metadata.
 */
export enum TeachingActivityType {
  REGULAR = 'regular',
  TOAN_VAN_ANH = 'toan_van_anh',
  HUAN_LUYEN = 'huan_luyen',
  LUYEN_THI = 'luyen_thi',
  IELTS = 'ielts',
  CLB = 'clb',
  TAM_LY = 'tam_ly',
}
