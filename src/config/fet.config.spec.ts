import { fetConfig, FetConfig } from './fet.config';

describe('FetConfig (fet.config.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('defaults', () => {
    it('should return sensible defaults when no env vars are set', () => {
      delete process.env.FET_DOCKER_IMAGE;
      delete process.env.FET_CPU_LIMIT;
      delete process.env.FET_MEMORY_LIMIT;
      delete process.env.FET_DEFAULT_TIMEOUT_SECONDS;
      delete process.env.FET_MAX_RETRIES;
      delete process.env.FET_RETRY_BASE_DELAY_MS;
      delete process.env.GENERATION_QUEUE_CONCURRENCY;
      delete process.env.GENERATION_QUEUE_PER_SCHOOL_LIMIT;

      const config: FetConfig = (fetConfig as unknown as () => FetConfig)();

      expect(config.engine.dockerImage).toBe('nbk-ems/fet:6.2.7');
      expect(config.engine.cpuLimit).toBe(2);
      expect(config.engine.memoryLimit).toBe('2g');
      expect(config.engine.defaultTimeoutSeconds).toBe(300);
      expect(config.engine.maxRetries).toBe(3);
      expect(config.engine.retryBaseDelayMs).toBe(1000);
      expect(config.queue.concurrency).toBe(2);
      expect(config.queue.perSchoolLimit).toBe(1);
    });
  });

  describe('custom env vars', () => {
    it('should read custom values from environment variables', () => {
      process.env.FET_DOCKER_IMAGE = 'custom/fet:7.0.0';
      process.env.FET_CPU_LIMIT = '4';
      process.env.FET_MEMORY_LIMIT = '4g';
      process.env.FET_DEFAULT_TIMEOUT_SECONDS = '600';
      process.env.FET_MAX_RETRIES = '5';
      process.env.FET_RETRY_BASE_DELAY_MS = '2000';
      process.env.GENERATION_QUEUE_CONCURRENCY = '4';
      process.env.GENERATION_QUEUE_PER_SCHOOL_LIMIT = '2';

      const config: FetConfig = (fetConfig as unknown as () => FetConfig)();

      expect(config.engine.dockerImage).toBe('custom/fet:7.0.0');
      expect(config.engine.cpuLimit).toBe(4);
      expect(config.engine.memoryLimit).toBe('4g');
      expect(config.engine.defaultTimeoutSeconds).toBe(600);
      expect(config.engine.maxRetries).toBe(5);
      expect(config.engine.retryBaseDelayMs).toBe(2000);
      expect(config.queue.concurrency).toBe(4);
      expect(config.queue.perSchoolLimit).toBe(2);
    });
  });

  describe('validation errors', () => {
    it('should throw when cpuLimit is 0', () => {
      process.env.FET_CPU_LIMIT = '0';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình FET Engine không hợp lệ',
      );
    });

    it('should throw when cpuLimit is negative', () => {
      process.env.FET_CPU_LIMIT = '-1';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình FET Engine không hợp lệ',
      );
    });

    it('should throw when defaultTimeoutSeconds is 0', () => {
      process.env.FET_DEFAULT_TIMEOUT_SECONDS = '0';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình FET Engine không hợp lệ',
      );
    });

    it('should throw when memoryLimit is empty', () => {
      process.env.FET_MEMORY_LIMIT = '';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình FET Engine không hợp lệ',
      );
    });

    it('should throw when dockerImage is empty', () => {
      process.env.FET_DOCKER_IMAGE = '';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình FET Engine không hợp lệ',
      );
    });

    it('should throw when queue concurrency is 0', () => {
      process.env.GENERATION_QUEUE_CONCURRENCY = '0';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình Generation Queue không hợp lệ',
      );
    });

    it('should throw when queue perSchoolLimit is 0', () => {
      process.env.GENERATION_QUEUE_PER_SCHOOL_LIMIT = '0';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình Generation Queue không hợp lệ',
      );
    });

    it('should throw when cpuLimit is NaN', () => {
      process.env.FET_CPU_LIMIT = 'abc';

      expect(() => (fetConfig as unknown as () => FetConfig)()).toThrow(
        'Cấu hình FET Engine không hợp lệ',
      );
    });
  });

  describe('edge cases', () => {
    it('should allow maxRetries = 0 (no retries)', () => {
      process.env.FET_MAX_RETRIES = '0';

      const config: FetConfig = (fetConfig as unknown as () => FetConfig)();
      expect(config.engine.maxRetries).toBe(0);
    });

    it('should allow retryBaseDelayMs = 0', () => {
      process.env.FET_RETRY_BASE_DELAY_MS = '0';

      const config: FetConfig = (fetConfig as unknown as () => FetConfig)();
      expect(config.engine.retryBaseDelayMs).toBe(0);
    });
  });
});
