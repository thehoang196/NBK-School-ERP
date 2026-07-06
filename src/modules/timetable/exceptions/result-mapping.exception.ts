/**
 * Thrown when an error occurs during the result mapping stage
 * (persisting parsed slots to the database).
 * Internal exception — no HTTP status (used within pipeline processing).
 */
export class ResultMappingException extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    const fullMessage = `Lỗi ánh xạ kết quả TKB: ${message}`;
    super(fullMessage);
    this.name = 'ResultMappingException';
    this.cause = cause;
  }
}
