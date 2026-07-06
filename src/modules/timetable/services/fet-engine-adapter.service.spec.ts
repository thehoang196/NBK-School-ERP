import { Test, TestingModule } from '@nestjs/testing';
import { FetEngineAdapterService } from './fet-engine-adapter.service';
import { fetConfig } from '../../../config/fet.config';
import { FetTimeoutException } from '../exceptions/fet-timeout.exception';
import { FetExecutionException } from '../exceptions/fet-execution.exception';
import { FetSolveParams } from '../interfaces/fet-dto.interface';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

// Mock child_process and fs/promises
jest.mock('child_process');
jest.mock('fs/promises');

const mockSpawn = childProcess.spawn as jest.MockedFunction<
  typeof childProcess.spawn
>;
const mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockRm = fs.rm as jest.MockedFunction<typeof fs.rm>;

describe('FetEngineAdapterService', () => {
  let service: FetEngineAdapterService;

  const mockConfig = {
    engine: {
      dockerImage: 'nbk-ems/fet:6.2.7',
      cpuLimit: 2,
      memoryLimit: '2g',
      defaultTimeoutSeconds: 300,
      maxRetries: 3,
      retryBaseDelayMs: 10, // Low for fast tests
    },
    queue: {
      concurrency: 2,
      perSchoolLimit: 1,
    },
  };

  const defaultParams: FetSolveParams = {
    inputXml: '<fet><institution>TestSchool</institution></fet>',
    timeoutSeconds: 60,
    jobId: 'test-job-001',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Default mock implementations
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetEngineAdapterService,
        {
          provide: fetConfig.KEY,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<FetEngineAdapterService>(FetEngineAdapterService);

    // Mock sleep to avoid real delays in tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
  });

  /**
   * Helper: Create a mock child process that emits events synchronously via process.nextTick.
   */
  function createMockProcess(options: {
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    emitError?: Error;
  }): ReturnType<typeof childProcess.spawn> {
    const { exitCode = 0, stdout = '', stderr = '', emitError } = options;

    const proc = new EventEmitter() as ReturnType<typeof childProcess.spawn>;
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();

    (proc as unknown as Record<string, unknown>).stdout = stdoutEmitter;
    (proc as unknown as Record<string, unknown>).stderr = stderrEmitter;
    (proc as unknown as Record<string, unknown>).kill = jest.fn();
    (proc as unknown as Record<string, unknown>).pid = 12345;

    // Use process.nextTick to emit events after listeners are attached
    process.nextTick(() => {
      if (emitError) {
        proc.emit('error', emitError);
        return;
      }
      if (stdout) {
        stdoutEmitter.emit('data', Buffer.from(stdout));
      }
      if (stderr) {
        stderrEmitter.emit('data', Buffer.from(stderr));
      }
      proc.emit('close', exitCode);
    });

    return proc;
  }

  /**
   * Helper: Create a mock process that hangs (never emits close) until killed.
   */
  function createHangingProcess(): {
    proc: ReturnType<typeof childProcess.spawn>;
    triggerKill: () => void;
  } {
    const proc = new EventEmitter() as ReturnType<typeof childProcess.spawn>;
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();

    (proc as unknown as Record<string, unknown>).stdout = stdoutEmitter;
    (proc as unknown as Record<string, unknown>).stderr = stderrEmitter;
    (proc as unknown as Record<string, unknown>).pid = 99999;

    const triggerKill = (): void => {
      process.nextTick(() => proc.emit('close', -1));
    };

    (proc as unknown as Record<string, unknown>).kill = jest
      .fn()
      .mockImplementation(triggerKill);

    return { proc, triggerKill };
  }

  describe('solve() — success path', () => {
    it('should return successful result when FET exits with code 0 and output file exists', async () => {
      const outputXml = '<fet_output>result</fet_output>';

      mockSpawn.mockReturnValue(createMockProcess({ exitCode: 0 }));
      mockReaddir.mockResolvedValue([
        'TestSchool_timetable_data_and_calculation.fet',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockReadFile.mockResolvedValue(outputXml);

      const result = await service.solve(defaultParams);

      expect(result.success).toBe(true);
      expect(result.outputXml).toBe(outputXml);
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.partialResult).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should write input XML to temp directory and cleanup after', async () => {
      mockSpawn.mockReturnValue(createMockProcess({ exitCode: 0 }));
      mockReaddir.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      await service.solve(defaultParams);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('fet-test-job-001'),
        { recursive: true },
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('input.fet'),
        defaultParams.inputXml,
        'utf-8',
      );
      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('fet-test-job-001'),
        { recursive: true, force: true },
      );
    });

    it('should pass correct Docker arguments with resource limits', async () => {
      mockSpawn.mockReturnValue(createMockProcess({ exitCode: 0 }));
      mockReaddir.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      await service.solve(defaultParams);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run',
          '--rm',
          '--cpus=2',
          '--memory=2g',
          'nbk-ems/fet:6.2.7',
          'fet-cl',
          '--inputfile',
          '/data/input.fet',
          '-t',
          '60',
        ]),
        expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
      );
    });

    it('should use defaultTimeoutSeconds when timeoutSeconds is 0', async () => {
      mockSpawn.mockReturnValue(createMockProcess({ exitCode: 0 }));
      mockReaddir.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      await service.solve({ ...defaultParams, timeoutSeconds: 0 });

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['-t', '300']),
        expect.anything(),
      );
    });
  });

  describe('solve() — timeout handling', () => {
    it('should throw FetTimeoutException when timeout occurs and no partial result', async () => {
      const { proc } = createHangingProcess();
      mockSpawn.mockReturnValue(proc);
      mockReaddir.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      // Use fake timers to control the hard timeout
      jest.useFakeTimers();

      const promise = service.solve({ ...defaultParams, timeoutSeconds: 1 });

      // Advance time past the hard timeout: (1 + 5) * 1000 = 6000ms
      await jest.advanceTimersByTimeAsync(7000);

      jest.useRealTimers();

      await expect(promise).rejects.toThrow(FetTimeoutException);
    }, 15000);

    it('should return partial result when timeout occurs but best-effort file exists', async () => {
      const bestEffortXml = '<partial_result>best effort</partial_result>';

      const { proc } = createHangingProcess();
      mockSpawn.mockReturnValue(proc);
      mockReaddir.mockResolvedValue([
        'TestSchool_best_effort_timetable.fet',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockReadFile.mockResolvedValue(bestEffortXml);

      jest.useFakeTimers();

      const promise = service.solve({ ...defaultParams, timeoutSeconds: 1 });

      await jest.advanceTimersByTimeAsync(7000);

      jest.useRealTimers();

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.outputXml).toBe(bestEffortXml);
      expect(result.timedOut).toBe(true);
      expect(result.partialResult).toBe(true);
    }, 15000);
  });

  describe('solve() — retry logic', () => {
    it('should retry on Docker connection error (up to maxRetries)', async () => {
      const connectionError = new Error('Cannot connect to Docker daemon');

      mockSpawn.mockImplementation(() =>
        createMockProcess({ emitError: connectionError }),
      );

      await expect(service.solve(defaultParams)).rejects.toThrow();

      // 3 retries
      expect(mockSpawn).toHaveBeenCalledTimes(3);
    });

    it('should retry on OOM kill (exit code 137)', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return createMockProcess({ exitCode: 137, stderr: 'killed' });
        }
        return createMockProcess({ exitCode: 0, stdout: 'done' });
      });

      mockReaddir.mockResolvedValue([
        'output_timetable_data_and_calculation.fet',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockReadFile.mockResolvedValue('<output/>');

      const result = await service.solve(defaultParams);

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff delay between retries', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sleepSpy = jest
        .spyOn(service as any, 'sleep')
        .mockResolvedValue(undefined);

      mockSpawn.mockImplementation(() =>
        createMockProcess({ exitCode: 137, stderr: '' }),
      );

      await expect(service.solve(defaultParams)).rejects.toThrow();

      // baseDelay = 10, so: 10 * 2^0 = 10, 10 * 2^1 = 20
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 10); // 10 * 2^0
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 20); // 10 * 2^1
    });

    it('should NOT retry on infeasible error', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({
          exitCode: 1,
          stderr: 'Impossible to solve this timetable',
        }),
      );

      const result = await service.solve(defaultParams);

      // Infeasible returns a result (not throws) on first attempt
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Impossible to solve');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on timeout exception', async () => {
      const { proc } = createHangingProcess();
      mockSpawn.mockReturnValue(proc);
      mockReaddir.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      jest.useFakeTimers();

      const promise = service.solve({ ...defaultParams, timeoutSeconds: 1 });

      await jest.advanceTimersByTimeAsync(7000);

      jest.useRealTimers();

      await expect(promise).rejects.toThrow(FetTimeoutException);
      // Should not retry — only 1 attempt
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    }, 15000);
  });

  describe('solve() — error handling', () => {
    it('should throw FetExecutionException for non-retryable non-zero exit', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({
          exitCode: 2,
          stderr: 'Unknown error in FET',
        }),
      );

      // Non-retryable, non-infeasible exit code → throws after first attempt
      await expect(service.solve(defaultParams)).rejects.toThrow(
        FetExecutionException,
      );
      // It's not retryable, so only 1 attempt
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should capture stderr in result on success', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({
          exitCode: 0,
          stderr: 'Warning: some non-critical issue',
        }),
      );
      mockReaddir.mockResolvedValue([
        'output_timetable_data_and_calculation.fet',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockReadFile.mockResolvedValue('<output/>');

      const result = await service.solve(defaultParams);

      expect(result.success).toBe(true);
      expect(result.stderr).toBe('Warning: some non-critical issue');
    });

    it('should cleanup temp directory even when execution fails', async () => {
      mockSpawn.mockReturnValue(
        createMockProcess({
          exitCode: 2,
          stderr: 'Fatal error',
        }),
      );

      await expect(service.solve(defaultParams)).rejects.toThrow();

      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('fet-test-job-001'),
        { recursive: true, force: true },
      );
    });

    it('should return success=false when exit code is 0 but no output file', async () => {
      mockSpawn.mockReturnValue(createMockProcess({ exitCode: 0 }));
      mockReaddir.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      const result = await service.solve(defaultParams);

      expect(result.success).toBe(false);
      expect(result.outputXml).toBeNull();
      expect(result.exitCode).toBe(0);
    });
  });
});
