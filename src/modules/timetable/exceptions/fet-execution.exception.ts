/**
 * Thrown when the FET engine exits with a non-zero exit code.
 * Internal exception — no HTTP status (used within pipeline processing).
 */
export class FetExecutionException extends Error {
  public readonly exitCode: number;
  public readonly stderr: string;

  constructor(exitCode: number, stderr: string) {
    const message = `FET engine kết thúc với mã lỗi ${exitCode}.`;
    super(message);
    this.name = 'FetExecutionException';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}
