export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enumValues?: string[];
}

export interface ReconciliationReportData {
  differences: ReconciliationDifference[];
  newFields: string[];
  newRecords: string[];
}

export interface ReconciliationDifference {
  employeeCode: string;
  fieldName: string;
  masterValue: string | null;
  sourceValue: string | null;
}
