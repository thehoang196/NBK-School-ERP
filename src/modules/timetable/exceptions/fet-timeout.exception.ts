/**
 * Thrown when the FET engine exceeds the allowed execution time.
 * Internal exception — no HTTP status (used within pipeline processing).
 */
export class FetTimeoutException extends Error {
  public readonly timeoutSeconds: number;

  constructor(timeoutSeconds: number) {
    const message = `FET engine vượt quá thời gian cho phép (${timeoutSeconds}s).`;
    super(message);
    this.name = 'FetTimeoutException';
    this.timeoutSeconds = timeoutSeconds;
  }
}
