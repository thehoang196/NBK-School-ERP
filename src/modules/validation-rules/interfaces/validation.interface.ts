/**
 * Kết quả validate một field.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: FieldValidationError[];
}

export interface FieldValidationError {
  fieldName: string;
  ruleType: string;
  message: string;
  value?: unknown;
}

/**
 * Kết quả validate toàn bộ một entity (nhiều fields).
 */
export interface EntityValidationResult {
  isValid: boolean;
  fieldErrors: Map<string, FieldValidationError[]>;
}

/**
 * Input cho batch validation (validate nhiều rows cùng lúc).
 */
export interface BatchValidationInput {
  entityTarget: string;
  schoolId: string;
  rows: Array<{
    rowIndex: number;
    data: Record<string, unknown>;
  }>;
}

/**
 * Kết quả validate batch.
 */
export interface BatchValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    rowIndex: number;
    fieldErrors: FieldValidationError[];
  }>;
}
