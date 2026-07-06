/**
 * Thrown when FET output fails referential integrity validation
 * (e.g., activity references a teacher or period not in the input context).
 * Internal exception — no HTTP status (used within pipeline processing).
 */
export class FetOutputValidationException extends Error {
  public readonly validationErrors: FetOutputValidationError[];

  constructor(validationErrors: FetOutputValidationError[]) {
    const summary = validationErrors
      .map((e) => `Activity ${e.activityId}: ${e.field} - ${e.message}`)
      .join('; ');
    const message = `Lỗi xác thực kết quả FET: ${summary}`;
    super(message);
    this.name = 'FetOutputValidationException';
    this.validationErrors = validationErrors;
  }
}

export interface FetOutputValidationError {
  activityId: string;
  field: string;
  message: string;
  rawValue: string;
}
