/**
 * Thrown when FET output XML cannot be parsed or has an invalid structure.
 * Internal exception — no HTTP status (used within pipeline processing).
 */
export class FetParseException extends Error {
  public readonly details: string;

  constructor(details: string) {
    const message = `Lỗi phân tích kết quả FET: ${details}`;
    super(message);
    this.name = 'FetParseException';
    this.details = details;
  }
}
