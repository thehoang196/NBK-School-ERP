/**
 * Built-in function library for the formula engine.
 * Provides mathematical, logical, and business functions.
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  params: { name: string; type: string; required: boolean }[];
  returnType: string;
  example: string;
  implementation: (...args: number[]) => number;
}

export const FUNCTION_LIBRARY: Record<string, FunctionDefinition> = {
  // Math functions
  SUM: {
    name: 'SUM',
    description: 'Tính tổng các giá trị',
    params: [{ name: 'values', type: 'number[]', required: true }],
    returnType: 'number',
    example: 'SUM(100, 200, 300)',
    implementation: (...args: number[]) =>
      args.reduce((sum, val) => sum + val, 0),
  },

  ROUND: {
    name: 'ROUND',
    description: 'Làm tròn số đến N chữ số thập phân',
    params: [
      { name: 'value', type: 'number', required: true },
      { name: 'decimals', type: 'number', required: true },
    ],
    returnType: 'number',
    example: 'ROUND(3.14159, 2)',
    implementation: (value: number, decimals: number) => {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    },
  },

  MIN: {
    name: 'MIN',
    description: 'Trả về giá trị nhỏ nhất',
    params: [
      { name: 'a', type: 'number', required: true },
      { name: 'b', type: 'number', required: true },
    ],
    returnType: 'number',
    example: 'MIN(100, 200)',
    implementation: (...args: number[]) => Math.min(...args),
  },

  MAX: {
    name: 'MAX',
    description: 'Trả về giá trị lớn nhất',
    params: [
      { name: 'a', type: 'number', required: true },
      { name: 'b', type: 'number', required: true },
    ],
    returnType: 'number',
    example: 'MAX(100, 200)',
    implementation: (...args: number[]) => Math.max(...args),
  },

  ABS: {
    name: 'ABS',
    description: 'Trả về giá trị tuyệt đối',
    params: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    example: 'ABS(-100)',
    implementation: (value: number) => Math.abs(value),
  },

  FLOOR: {
    name: 'FLOOR',
    description: 'Làm tròn xuống',
    params: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    example: 'FLOOR(3.7)',
    implementation: (value: number) => Math.floor(value),
  },

  CEIL: {
    name: 'CEIL',
    description: 'Làm tròn lên',
    params: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    example: 'CEIL(3.2)',
    implementation: (value: number) => Math.ceil(value),
  },

  // Logic functions
  IF: {
    name: 'IF',
    description:
      'Điều kiện: nếu condition != 0 thì trả true_value, ngược lại trả false_value',
    params: [
      { name: 'condition', type: 'number', required: true },
      { name: 'true_value', type: 'number', required: true },
      { name: 'false_value', type: 'number', required: true },
    ],
    returnType: 'number',
    example: 'IF(HOURS > 40, HOURS * OT_RATE, HOURS * NORMAL_RATE)',
    implementation: (condition: number, trueVal: number, falseVal: number) =>
      condition !== 0 ? trueVal : falseVal,
  },

  // Business functions — resolved at runtime via service layer
  TeachingHours: {
    name: 'TeachingHours',
    description: 'Tổng số tiết dạy thực tế của giáo viên trong kỳ lương',
    params: [
      { name: 'teacher_id', type: 'string', required: true },
      { name: 'period_id', type: 'string', required: true },
    ],
    returnType: 'number',
    example: 'TeachingHours(teacher_id, period_id)',
    implementation: (...args: number[]) => args[0] || 0, // Runtime: resolved via TeachingMetricsService
  },

  TeachingHoursBySubject: {
    name: 'TeachingHoursBySubject',
    description: 'Số tiết dạy của giáo viên cho một môn cụ thể',
    params: [
      { name: 'teacher_id', type: 'string', required: true },
      { name: 'period_id', type: 'string', required: true },
      { name: 'subject_id', type: 'string', required: true },
    ],
    returnType: 'number',
    example: 'TeachingHoursBySubject(teacher_id, period_id, subject_id)',
    implementation: (...args: number[]) => args[0] || 0, // Runtime: resolved via TeachingMetricsService
  },

  TeachingHoursByType: {
    name: 'TeachingHoursByType',
    description: 'Số tiết dạy theo loại hoạt động (regular, toan_van_anh, huan_luyen, luyen_thi, ielts, clb, tam_ly)',
    params: [
      { name: 'teacher_id', type: 'string', required: true },
      { name: 'period_id', type: 'string', required: true },
      { name: 'activity_type', type: 'string', required: true },
    ],
    returnType: 'number',
    example: 'TeachingHoursByType(teacher_id, period_id, "ielts")',
    implementation: (...args: number[]) => args[0] || 0, // Runtime: resolved via TeachingMetricsService
  },

  AttendanceDays: {
    name: 'AttendanceDays',
    description: 'Số ngày chấm công của giáo viên trong kỳ lương',
    params: [
      { name: 'teacher_id', type: 'string', required: true },
      { name: 'period_id', type: 'string', required: true },
    ],
    returnType: 'number',
    example: 'AttendanceDays(teacher_id, period_id)',
    implementation: (...args: number[]) => args[0] || 0, // Runtime: resolved via AttendanceSummaryService
  },
};

/**
 * Get set of all available function names
 */
export function getAvailableFunctionNames(): Set<string> {
  return new Set(Object.keys(FUNCTION_LIBRARY));
}

/**
 * Get function implementations as a Record for the Evaluator
 */
export function getFunctionImplementations(): Record<
  string,
  (...args: number[]) => number
> {
  const fns: Record<string, (...args: number[]) => number> = {};
  for (const [name, def] of Object.entries(FUNCTION_LIBRARY)) {
    fns[name] = def.implementation;
  }
  return fns;
}
