import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { fetConfig } from '../../../config/fet.config';
import {
  FetSolveParams,
  FetSolveResult,
} from '../interfaces/fet-dto.interface';
import { IFetEngineAdapter } from '../interfaces/generation-pipeline.interface';
import { FetTimeoutException } from '../exceptions/fet-timeout.exception';
import { FetExecutionException } from '../exceptions/fet-execution.exception';

/**
 * Adapter Pattern wrapping FET v6.x CLI execution via Docker.
 *
 * Responsibilities:
 * - Write input XML to a temp directory
 * - Spawn a Docker container with resource limits
 * - Apply hard timeout with container kill
 * - Capture stdout, stderr, exit code, and timing
 * - Handle partial result files on timeout (best-effort)
 * - Exponential backoff retry for transient errors
 * - Structured logging with jobId correlation
 * - Cleanup temp files in finally block
 */
@Injectable()
export class FetEngineAdapterService implements IFetEngineAdapter {
  private readonly logger = new Logger(FetEngineAdapterService.name);

  constructor(
    @Inject(fetConfig.KEY)
    private readonly config: ConfigType<typeof fetConfig>,
  ) {}

  async solve(params: FetSolveParams): Promise<FetSolveResult> {
    const { inputXml, timeoutSeconds, jobId } = params;
    const engineConfig = this.config.engine;
    const effectiveTimeout =
      timeoutSeconds || engineConfig.defaultTimeoutSeconds;
    const maxRetries = engineConfig.maxRetries;
    const baseDelay = engineConfig.retryBaseDelayMs;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `[${jobId}] Attempt ${attempt}/${maxRetries} — timeout: ${effectiveTimeout}s`,
        );

        const result = await this.executeFetContainer(
          inputXml,
          effectiveTimeout,
          jobId,
        );

        if (result.success) {
          this.logger.log(
            `[${jobId}] FET solved successfully in ${result.durationMs}ms`,
          );
        }

        return result;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        if (!this.isRetryable(err)) {
          this.logger.error(
            `[${jobId}] Non-retryable error on attempt ${attempt}: ${err.message}`,
          );
          throw err;
        }

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          this.logger.warn(
            `[${jobId}] Retryable error on attempt ${attempt}/${maxRetries}. ` +
              `Retrying in ${delay}ms: ${err.message}`,
          );
          await this.sleep(delay);
        } else {
          this.logger.error(
            `[${jobId}] All ${maxRetries} attempts exhausted. Last error: ${err.message}`,
          );
        }
      }
    }

    throw lastError ?? new Error(`[${jobId}] All retry attempts exhausted`);
  }

  /**
   * Execute FET CLI inside a Docker container.
   */
  private async executeFetContainer(
    inputXml: string,
    timeoutSeconds: number,
    jobId: string,
  ): Promise<FetSolveResult> {
    const tempDir = path.join(os.tmpdir(), `fet-${jobId}`);

    try {
      // Step 1: Write input XML to temp directory
      await fs.mkdir(tempDir, { recursive: true });
      const inputFilePath = path.join(tempDir, 'input.fet');
      await fs.writeFile(inputFilePath, inputXml, 'utf-8');

      this.logger.debug(
        `[${jobId}] Input XML written to ${inputFilePath} (${inputXml.length} bytes)`,
      );

      // Step 2: Build Docker command arguments
      const engineConfig = this.config.engine;
      const dockerArgs = this.buildDockerArgs(
        tempDir,
        timeoutSeconds,
        engineConfig,
      );

      this.logger.debug(
        `[${jobId}] Docker command: docker ${dockerArgs.join(' ')}`,
      );

      // Step 3: Spawn Docker process with hard timeout
      const startTime = Date.now();
      const { exitCode, stdout, stderr, timedOut } =
        await this.spawnDockerProcess(dockerArgs, timeoutSeconds, jobId);
      const durationMs = Date.now() - startTime;

      this.logger.debug(
        `[${jobId}] Docker exited: code=${exitCode}, timedOut=${timedOut}, duration=${durationMs}ms`,
      );

      // Step 4: Handle results
      if (timedOut) {
        return await this.handleTimeout(
          tempDir,
          exitCode,
          stderr,
          durationMs,
          timeoutSeconds,
          jobId,
        );
      }

      if (exitCode === 0) {
        const outputXml = await this.readOutputFile(tempDir, jobId);
        return {
          success: outputXml !== null,
          outputXml,
          exitCode,
          stderr,
          durationMs,
          timedOut: false,
          partialResult: false,
        };
      }

      // Non-zero exit — check if it's a retryable condition
      if (this.isRetryableExitCode(exitCode, stderr)) {
        throw new FetExecutionException(exitCode, stderr);
      }

      // Non-retryable failure (e.g., infeasible)
      if (this.isInfeasible(stderr)) {
        return {
          success: false,
          outputXml: null,
          exitCode,
          stderr,
          durationMs,
          timedOut: false,
          partialResult: false,
        };
      }

      // Other non-zero exit
      throw new FetExecutionException(exitCode, stderr);
    } finally {
      // Step 5: Cleanup temp directory
      await this.cleanupTempDir(tempDir, jobId);
    }
  }

  /**
   * Build Docker run arguments with resource limits.
   */
  private buildDockerArgs(
    tempDir: string,
    timeoutSeconds: number,
    engineConfig: {
      dockerImage: string;
      cpuLimit: number;
      memoryLimit: string;
    },
  ): string[] {
    return [
      'run',
      '--rm',
      `--cpus=${engineConfig.cpuLimit}`,
      `--memory=${engineConfig.memoryLimit}`,
      '-v',
      `${tempDir}:/data`,
      engineConfig.dockerImage,
      'fet-cl',
      '--inputfile',
      '/data/input.fet',
      '-t',
      String(timeoutSeconds),
    ];
  }

  /**
   * Spawn docker process and capture output with hard timeout enforcement.
   */
  private spawnDockerProcess(
    args: string[],
    timeoutSeconds: number,
    jobId: string,
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let resolved = false;

      const child: ChildProcess = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Hard timeout: kill container if it exceeds configured timeout
      // Add buffer (5s) beyond FET's internal timeout for Docker overhead
      const hardTimeoutMs = (timeoutSeconds + 5) * 1000;
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          timedOut = true;
          this.logger.warn(
            `[${jobId}] Hard timeout reached (${timeoutSeconds + 5}s). Killing container.`,
          );
          child.kill('SIGKILL');
        }
      }, hardTimeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        if (!resolved) {
          resolved = true;
          reject(new FetExecutionException(-1, error.message));
        }
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        if (!resolved) {
          resolved = true;
          resolve({
            exitCode: code ?? -1,
            stdout,
            stderr,
            timedOut,
          });
        }
      });
    });
  }

  /**
   * Handle timeout scenario — check for partial (best-effort) result file.
   */
  private async handleTimeout(
    tempDir: string,
    exitCode: number,
    stderr: string,
    durationMs: number,
    timeoutSeconds: number,
    jobId: string,
  ): Promise<FetSolveResult> {
    const partialXml = await this.readBestEffortFile(tempDir, jobId);

    if (partialXml) {
      this.logger.warn(
        `[${jobId}] Timeout reached but partial (best-effort) result found.`,
      );
      return {
        success: false,
        outputXml: partialXml,
        exitCode,
        stderr,
        durationMs,
        timedOut: true,
        partialResult: true,
      };
    }

    // No partial result — throw timeout exception
    this.logger.error(
      `[${jobId}] Timeout exceeded (${timeoutSeconds}s) with no partial result.`,
    );
    throw new FetTimeoutException(timeoutSeconds);
  }

  /**
   * Read the standard FET output file from the temp directory.
   * FET outputs to: {tempDir}/{institution}_timetable_data_and_calculation.fet
   * Since we don't know the institution name, we search for the pattern.
   */
  private async readOutputFile(
    tempDir: string,
    jobId: string,
  ): Promise<string | null> {
    try {
      const files = await fs.readdir(tempDir);
      const outputFile = files.find(
        (f) =>
          f.endsWith('_timetable_data_and_calculation.fet') ||
          f.endsWith('_activities.xml'),
      );

      if (outputFile) {
        const outputPath = path.join(tempDir, outputFile);
        const content = await fs.readFile(outputPath, 'utf-8');
        this.logger.debug(
          `[${jobId}] Output file read: ${outputFile} (${content.length} bytes)`,
        );
        return content;
      }

      this.logger.warn(`[${jobId}] No output file found in ${tempDir}`);
      return null;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${jobId}] Error reading output file: ${msg}`);
      return null;
    }
  }

  /**
   * Read best-effort file if timeout and partial result exists.
   * FET creates files matching *_best_effort* pattern on timeout.
   */
  private async readBestEffortFile(
    tempDir: string,
    jobId: string,
  ): Promise<string | null> {
    try {
      const files = await fs.readdir(tempDir);
      const bestEffortFile = files.find((f) =>
        f.toLowerCase().includes('best_effort'),
      );

      if (bestEffortFile) {
        const filePath = path.join(tempDir, bestEffortFile);
        const content = await fs.readFile(filePath, 'utf-8');
        this.logger.debug(
          `[${jobId}] Best-effort file found: ${bestEffortFile} (${content.length} bytes)`,
        );
        return content;
      }

      return null;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.debug(`[${jobId}] No best-effort file found: ${msg}`);
      return null;
    }
  }

  /**
   * Determine if an error is retryable.
   * Retryable: Docker connection error, OOM kill (exit 137)
   * Non-retryable: FET "infeasible", timeout
   */
  private isRetryable(error: Error): boolean {
    if (error instanceof FetTimeoutException) {
      return false;
    }

    if (error instanceof FetExecutionException) {
      return this.isRetryableExitCode(error.exitCode, error.stderr);
    }

    // Generic errors (e.g., ENOENT for docker binary) are retryable
    const message = error.message.toLowerCase();
    if (
      message.includes('cannot connect to docker') ||
      message.includes('enoent') ||
      message.includes('connection refused')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if an exit code + stderr combination indicates a retryable condition.
   */
  private isRetryableExitCode(exitCode: number, stderr: string): boolean {
    // Exit 137 = OOM kill (SIGKILL by kernel or Docker)
    if (exitCode === 137) {
      return true;
    }

    // Docker connection errors
    const lowerStderr = stderr.toLowerCase();
    if (
      lowerStderr.includes('cannot connect to docker') ||
      lowerStderr.includes('connection refused') ||
      lowerStderr.includes('docker daemon')
    ) {
      return true;
    }

    // Infeasible is NOT retryable
    if (this.isInfeasible(stderr)) {
      return false;
    }

    return false;
  }

  /**
   * Check if FET reported the problem as infeasible / impossible to solve.
   */
  private isInfeasible(stderr: string): boolean {
    const lower = stderr.toLowerCase();
    return (
      lower.includes('impossible to solve') ||
      lower.includes('infeasible') ||
      lower.includes('cannot solve')
    );
  }

  /**
   * Clean up temporary directory after execution.
   */
  private async cleanupTempDir(tempDir: string, jobId: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      this.logger.debug(`[${jobId}] Temp directory cleaned: ${tempDir}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[${jobId}] Failed to clean temp directory ${tempDir}: ${msg}`,
      );
    }
  }

  /**
   * Sleep utility for retry backoff delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
