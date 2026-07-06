import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsNumber,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * FET Engine configuration for Docker execution.
 */
export class FetEngineConfigSchema {
  @IsString()
  @MinLength(1)
  dockerImage: string;

  @IsNumber()
  @Min(1)
  cpuLimit: number;

  @IsString()
  @MinLength(1)
  memoryLimit: string;

  @IsNumber()
  @Min(1)
  defaultTimeoutSeconds: number;

  @IsNumber()
  @Min(0)
  maxRetries: number;

  @IsNumber()
  @Min(0)
  retryBaseDelayMs: number;
}

/**
 * Queue configuration for BullMQ timetable-generation queue.
 */
export class GenerationQueueConfigSchema {
  @IsNumber()
  @Min(1)
  concurrency: number;

  @IsNumber()
  @Min(1)
  perSchoolLimit: number;
}

export interface FetConfig {
  engine: FetEngineConfigSchema;
  queue: GenerationQueueConfigSchema;
}

export const fetConfig = registerAs('fet', (): FetConfig => {
  const engine = plainToInstance(FetEngineConfigSchema, {
    dockerImage: process.env.FET_DOCKER_IMAGE ?? 'nbk-ems/fet:6.2.7',
    cpuLimit: parseInt(process.env.FET_CPU_LIMIT ?? '2', 10),
    memoryLimit: process.env.FET_MEMORY_LIMIT ?? '2g',
    defaultTimeoutSeconds: parseInt(
      process.env.FET_DEFAULT_TIMEOUT_SECONDS ?? '300',
      10,
    ),
    maxRetries: parseInt(process.env.FET_MAX_RETRIES ?? '3', 10),
    retryBaseDelayMs: parseInt(
      process.env.FET_RETRY_BASE_DELAY_MS ?? '1000',
      10,
    ),
  });

  const queue = plainToInstance(GenerationQueueConfigSchema, {
    concurrency: parseInt(process.env.GENERATION_QUEUE_CONCURRENCY ?? '2', 10),
    perSchoolLimit: parseInt(
      process.env.GENERATION_QUEUE_PER_SCHOOL_LIMIT ?? '1',
      10,
    ),
  });

  const engineErrors = validateSync(engine, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (engineErrors.length > 0) {
    const messages = engineErrors
      .map((e) => Object.values(e.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Cấu hình FET Engine không hợp lệ: ${messages}`);
  }

  const queueErrors = validateSync(queue, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (queueErrors.length > 0) {
    const messages = queueErrors
      .map((e) => Object.values(e.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Cấu hình Generation Queue không hợp lệ: ${messages}`);
  }

  return { engine, queue };
});
